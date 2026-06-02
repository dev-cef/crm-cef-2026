"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { eventSchema, type EventFormValues } from "@/lib/validations/event";
import {
  intervaloMes,
  listarDatasMuro,
  MURO_THURSDAY_BLOCKERS,
  ultimaQuintaDoMes,
  ymd,
} from "@/lib/events/muro-recorrencia";

type Result = { ok: boolean; id?: string; error?: string };

// Dados auto-preenchidos por tipo (servidor é a fonte de verdade)
function autoData(code: string) {
  const now = new Date();
  switch (code) {
    case "reuniao_social":
      return {
        name: "Reunião Social",
        description: "Reunião social do CEF.",
        location: "Sede CEF",
        difficulty: "FACIL",
        slots: 0,
      };
    case "aniversario_cef": {
      const dt = ultimaQuintaDoMes(now.getFullYear(), now.getMonth() + 1);
      return {
        name: "Aniversário CEF",
        description: "Comemoração do aniversário do CEF com os associados e aniversariantes do mês.",
        location: "Sede CEF",
        difficulty: "FACIL",
        slots: 60,
        dateTime: dt,
      };
    }
    default:
      return {};
  }
}

export async function saveEvent(
  values: EventFormValues,
  id?: string,
): Promise<Result> {
  const session = await auth();
  const parsed = eventSchema.safeParse(values);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    console.error("[saveEvent] Zod errors:", JSON.stringify(issues, null, 2));
    const first = issues[0];
    const field = first?.path?.join(".") ?? "";
    const msg = field ? `${field}: ${first?.message}` : (first?.message ?? "Inválido");
    return { ok: false, error: msg };
  }
  const d = parsed.data;
  const auto = autoData(d.categoryCode);

  // Suporte a múltiplos guias: guideIds é a fonte de verdade.
  // guideId (FK) mantém o primeiro guia para compatibilidade com dados existentes.
  const resolvedGuideIds = d.guideIds.length > 0 ? d.guideIds : (d.guideId ? [d.guideId] : []);
  const resolvedGuideId = resolvedGuideIds[0] ?? null;
  const guideConnect = resolvedGuideId
    ? { guide: { connect: { id: resolvedGuideId } } }
    : id
      ? { guide: { disconnect: true } }
      : {};

  const data = {
    name: (auto as { name?: string }).name ?? d.name,
    description: (auto as { description?: string }).description ?? d.description,
    dateTime: (auto as { dateTime?: Date }).dateTime ?? new Date(d.dateTime),
    location: (auto as { location?: string }).location ?? d.location,
    difficulty: ((auto as { difficulty?: string }).difficulty ?? d.difficulty) || "FACIL",
    slots: (auto as { slots?: number }).slots ?? d.slots,
    status: d.status,
    categoryCode: d.categoryCode,
    speakerName: d.speakerName || null,
    filmDuration: d.filmDuration || null,
    generalAttendeeNames: JSON.stringify(d.generalAttendeeNames),
    guideIds: JSON.stringify(resolvedGuideIds),
    fichaDistanciaKm:  d.fichaDistanciaKm  ?? null,
    fichaTempo:        d.fichaTempo        || null,
    fichaEsforco:      d.fichaEsforco      || null,
    fichaInsolacao:    d.fichaInsolacao    || null,
    fichaDesnivelPos:  d.fichaDesnivelPos  ?? null,
    fichaElevacaoMax:  d.fichaElevacaoMax  ?? null,
    fichaExposicao:    d.fichaExposicao    || null,
    fichaSaidaHorario: d.fichaSaidaHorario || null,
    fichaSaidaLocal:   d.fichaSaidaLocal   || null,
    fichaCarona:       d.fichaCarona       ?? false,
    fichaOQueLevar:    JSON.stringify(d.fichaOQueLevar),
    fichaObs:          d.fichaObs          || null,
    fichaAtencao:      d.fichaAtencao      || null,
    ...guideConnect,
  };

  try {
    const ev = id
      ? await prisma.event.update({ where: { id }, data })
      : await prisma.event.create({ data });

    // Sincronizar "Público que foi" (EventAttendee)
    const existingAttendees = await prisma.eventAttendee.findMany({
      where: { eventId: ev.id },
      select: { id: true, memberId: true },
    });
    const existingMemberIds = new Set(existingAttendees.map((a) => a.memberId));
    const newMemberIds = new Set(d.attendeeIds);

    // Remover os que saíram
    const toDelete = existingAttendees
      .filter((a) => !newMemberIds.has(a.memberId))
      .map((a) => a.id);
    if (toDelete.length > 0) {
      await prisma.eventAttendee.deleteMany({ where: { id: { in: toDelete } } });
    }

    // Adicionar os novos
    const toAdd = d.attendeeIds.filter((mid) => !existingMemberIds.has(mid));
    if (toAdd.length > 0) {
      await prisma.eventAttendee.createMany({
        data: toAdd.map((memberId) => ({ eventId: ev.id, memberId })),
        skipDuplicates: true,
      });
    }

    await recordAudit({
      userId: session?.user?.id,
      action: id ? "UPDATE" : "CREATE",
      entity: "Event",
      entityId: ev.id,
    });
    revalidatePath("/eventos");
    revalidatePath(`/eventos/${ev.id}`);
    revalidatePath("/dashboard");
    return { ok: true, id: ev.id };
  } catch (err) {
    console.error("[saveEvent] Error:", err);
    // Prisma P2025 = record not found (e.g. event was deleted before save)
    if (err && typeof err === "object" && "code" in err && err.code === "P2025") {
      return { ok: false, error: "Evento não encontrado. Pode ter sido excluído. Volte à lista de eventos." };
    }
    const msg = err instanceof Error ? err.message : "Erro ao salvar o evento.";
    return { ok: false, error: msg };
  }
}

export async function deleteEvent(id: string): Promise<Result> {
  const session = await auth();
  try {
    await prisma.event.delete({ where: { id } });
    await recordAudit({
      userId: session?.user?.id,
      action: "DELETE",
      entity: "Event",
      entityId: id,
    });
    revalidatePath("/eventos");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao excluir o evento." };
  }
}

export async function addRegistration(
  eventId: string,
  memberId: string,
): Promise<Result & { waitlisted?: boolean; position?: number }> {
  try {
    const ev = await prisma.event.findUnique({
      where: { id: eventId },
      include: { _count: { select: { registrations: true } } },
    });
    if (!ev) return { ok: false, error: "Evento não encontrado." };

    const isFull = ev.slots > 0 && ev._count.registrations >= ev.slots;

    if (isFull) {
      // Check if already in waitlist
      const existing = await prisma.eventWaitlist.findUnique({
        where: { eventId_memberId: { eventId, memberId } },
      });
      if (existing) {
        return { ok: false, error: "Você já está na fila de espera." };
      }
      // Compute next position
      const last = await prisma.eventWaitlist.findFirst({
        where: { eventId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const position = (last?.position ?? 0) + 1;
      await prisma.eventWaitlist.create({ data: { eventId, memberId, position } });
      revalidatePath(`/eventos/${eventId}`);
      return { ok: true, waitlisted: true, position };
    }

    await prisma.eventRegistration.create({ data: { eventId, memberId } });
    revalidatePath(`/eventos/${eventId}`);
    return { ok: true, waitlisted: false };
  } catch {
    return { ok: false, error: "Associado já inscrito ou erro." };
  }
}

export async function removeRegistration(
  registrationId: string,
  eventId: string,
): Promise<Result> {
  try {
    await prisma.eventRegistration.delete({ where: { id: registrationId } });

    // Promote first person from waitlist (if any)
    const ev = await prisma.event.findUnique({
      where: { id: eventId },
      select: { slots: true },
    });
    if (ev && ev.slots > 0) {
      const next = await prisma.eventWaitlist.findFirst({
        where: { eventId },
        orderBy: { position: "asc" },
      });
      if (next) {
        await prisma.$transaction([
          prisma.eventRegistration.create({
            data: { eventId, memberId: next.memberId },
          }),
          prisma.eventWaitlist.delete({ where: { id: next.id } }),
        ]);
      }
    }

    revalidatePath(`/eventos/${eventId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao remover inscrição." };
  }
}

export async function removeWaitlist(
  waitlistId: string,
  eventId: string,
): Promise<Result> {
  try {
    await prisma.eventWaitlist.delete({ where: { id: waitlistId } });
    revalidatePath(`/eventos/${eventId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao remover da fila de espera." };
  }
}

// ── Carona colaborativa ──────────────────────────────────────────────────────

export async function offerCarona(
  eventId: string,
  driverId: string,
  seats: number,
  note?: string,
): Promise<Result> {
  try {
    await prisma.eventCarona.upsert({
      where: { eventId_driverId: { eventId, driverId } },
      create: { eventId, driverId, seats, note: note || null },
      update: { seats, note: note || null },
    });
    revalidatePath(`/eventos/${eventId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao oferecer carona." };
  }
}

export async function cancelCaronaOffer(
  caronaId: string,
  eventId: string,
): Promise<Result> {
  try {
    await prisma.eventCarona.delete({ where: { id: caronaId } });
    revalidatePath(`/eventos/${eventId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao cancelar oferta de carona." };
  }
}

export async function claimSeat(
  caronaId: string,
  memberId: string,
  eventId: string,
): Promise<Result> {
  try {
    const carona = await prisma.eventCarona.findUnique({
      where: { id: caronaId },
      include: { _count: { select: { passengers: true } } },
    });
    if (!carona) return { ok: false, error: "Carona não encontrada." };
    if (carona._count.passengers >= carona.seats)
      return { ok: false, error: "Não há vagas disponíveis nesta carona." };
    if (carona.driverId === memberId)
      return { ok: false, error: "Você não pode reservar vaga no próprio carro." };
    await prisma.eventCaronaPassenger.create({ data: { caronaId, memberId } });
    revalidatePath(`/eventos/${eventId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Você já reservou vaga nesta carona." };
  }
}

export async function releaseSeat(
  passengerId: string,
  eventId: string,
): Promise<Result> {
  try {
    await prisma.eventCaronaPassenger.delete({ where: { id: passengerId } });
    revalidatePath(`/eventos/${eventId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao liberar vaga." };
  }
}

export async function addPhotos(
  eventId: string,
  dataUrls: string[],
): Promise<Result> {
  try {
    const valid = dataUrls
      .filter((u) => u.startsWith("data:image/"))
      .slice(0, 20);
    if (valid.length === 0)
      return { ok: false, error: "Nenhuma imagem válida." };
    await prisma.eventPhoto.createMany({
      data: valid.map((url) => ({ eventId, url })),
    });
    revalidatePath(`/eventos/${eventId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao enviar fotos." };
  }
}

export async function removePhoto(
  photoId: string,
  eventId: string,
): Promise<Result> {
  try {
    await prisma.eventPhoto.delete({ where: { id: photoId } });
    revalidatePath(`/eventos/${eventId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao remover foto." };
  }
}

type ProjetarMuroResult = {
  ok: boolean;
  criados: number;
  pulados: number;
  ignoradosQuinta: number;
  jaExistentes: number;
  error?: string;
};

export async function projetarMuroDoMes(
  ano: number,
  mes: number,
): Promise<ProjetarMuroResult> {
  const session = await auth();
  if (!session?.user)
    return {
      ok: false,
      criados: 0,
      pulados: 0,
      ignoradosQuinta: 0,
      jaExistentes: 0,
      error: "Não autenticado",
    };

  try {
    const { start, end } = intervaloMes(ano, mes);

    const bloqueadores = await prisma.event.findMany({
      where: {
        dateTime: { gte: start, lt: end },
        categoryCode: { in: [...MURO_THURSDAY_BLOCKERS] },
        status: { not: "CANCELADO" },
      },
      select: { dateTime: true },
    });
    const quintasBloqueadas = new Set(
      bloqueadores
        .filter((b) => b.dateTime.getDay() === 4)
        .map((b) => ymd(b.dateTime)),
    );

    const existentes = await prisma.event.findMany({
      where: {
        dateTime: { gte: start, lt: end },
        categoryCode: "muro_escalada",
      },
      select: { dateTime: true },
    });
    const diasComMuro = new Set(existentes.map((e) => ymd(e.dateTime)));

    const ocorrencias = listarDatasMuro(start, end, quintasBloqueadas);

    const aCriar: Date[] = [];
    let ignoradosQuinta = 0;
    let jaExistentes = 0;
    for (const o of ocorrencias) {
      if (o.skipped) {
        ignoradosQuinta++;
        continue;
      }
      if (diasComMuro.has(ymd(o.date))) {
        jaExistentes++;
        continue;
      }
      aCriar.push(o.date);
    }

    if (aCriar.length === 0) {
      return {
        ok: true,
        criados: 0,
        pulados: ignoradosQuinta + jaExistentes,
        ignoradosQuinta,
        jaExistentes,
      };
    }

    await prisma.event.createMany({
      data: aCriar.map((date) => ({
        name: "Muro de Escalada",
        description:
          "Treino no muro de escalada do CEF. Aberto a associados e convidados.",
        dateTime: date,
        location: "Muro de Escalada — Sede CEF",
        difficulty: "MODERADO",
        slots: 0,
        status: "PLANEJADO",
        categoryCode: "muro_escalada",
        eventCategory: "ATIVIDADE",
      })),
    });

    await recordAudit({
      userId: session.user.id,
      action: "CREATE",
      entity: "Event",
      entityId: `muro:${ano}-${String(mes).padStart(2, "0")}`,
      metadata: {
        kind: "projetar_muro",
        criados: aCriar.length,
        ignoradosQuinta,
        jaExistentes,
      },
    });

    revalidatePath("/eventos");
    revalidatePath("/dashboard");

    return {
      ok: true,
      criados: aCriar.length,
      pulados: ignoradosQuinta + jaExistentes,
      ignoradosQuinta,
      jaExistentes,
    };
  } catch (err) {
    return {
      ok: false,
      criados: 0,
      pulados: 0,
      ignoradosQuinta: 0,
      jaExistentes: 0,
      error: err instanceof Error ? err.message : "Erro ao projetar muro.",
    };
  }
}

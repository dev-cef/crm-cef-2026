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
  ymd,
} from "@/lib/events/muro-recorrencia";

type Result = { ok: boolean; id?: string; error?: string };

export async function saveEvent(
  values: EventFormValues,
  id?: string,
): Promise<Result> {
  const session = await auth();
  const parsed = eventSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  }
  const d = parsed.data;
  const data = {
    name: d.name,
    description: d.description,
    dateTime: new Date(d.dateTime),
    location: d.location,
    difficulty: d.difficulty,
    slots: d.slots,
    status: d.status,
    categoryCode: d.categoryCode ? d.categoryCode : null,
    guideId: d.guideId ? d.guideId : null,
  };

  try {
    const ev = id
      ? await prisma.event.update({ where: { id }, data })
      : await prisma.event.create({ data });
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
  } catch {
    return { ok: false, error: "Erro ao salvar o evento." };
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
): Promise<Result> {
  try {
    const ev = await prisma.event.findUnique({
      where: { id: eventId },
      include: { _count: { select: { registrations: true } } },
    });
    if (!ev) return { ok: false, error: "Evento não encontrado." };
    if (ev.slots > 0 && ev._count.registrations >= ev.slots) {
      return { ok: false, error: "Não há vagas disponíveis." };
    }
    await prisma.eventRegistration.create({
      data: { eventId, memberId },
    });
    revalidatePath(`/eventos/${eventId}`);
    return { ok: true };
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
    revalidatePath(`/eventos/${eventId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao remover inscrição." };
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

/**
 * Projeta ocorrências do Muro de Escalada (categoryCode = "muro_escalada") em
 * um mês alvo. Aplica R4: Seg/Qua sempre; Qui só se não houver evento
 * concorrente das categorias bloqueadoras (Altos Papos, CEF Cine Montanha,
 * Aniversário CEF, Confraternização).
 *
 * Idempotente: não duplica se já existir um muro no mesmo dia.
 */
export async function projetarMuroDoMes(
  ano: number,
  mes: number, // 1..12
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

    // (1) Quintas bloqueadas — busca eventos do mês em categorias bloqueadoras.
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
        .filter((b) => b.dateTime.getDay() === 4) // 4 = quinta no JS
        .map((b) => ymd(b.dateTime)),
    );

    // (2) Eventos muro já existentes no intervalo (pra idempotência).
    const existentes = await prisma.event.findMany({
      where: {
        dateTime: { gte: start, lt: end },
        categoryCode: "muro_escalada",
      },
      select: { dateTime: true },
    });
    const diasComMuro = new Set(existentes.map((e) => ymd(e.dateTime)));

    // (3) Datas candidatas a partir da função pura.
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

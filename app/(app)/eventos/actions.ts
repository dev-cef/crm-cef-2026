"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { eventSchema, type EventFormValues } from "@/lib/validations/event";

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

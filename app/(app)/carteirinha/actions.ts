"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function updateCardSettings(
  memberId: string,
  registration: number,
  cardValidUntil: string | null, // ISO date string or null
): Promise<{ ok: boolean; error?: string }> {
  if (!registration || registration < 1) {
    return { ok: false, error: "Número de matrícula inválido." };
  }

  const existing = await prisma.member.findFirst({
    where: { registration, NOT: { id: memberId } },
  });
  if (existing) {
    return { ok: false, error: "Este número de matrícula já está em uso." };
  }

  await prisma.member.update({
    where: { id: memberId },
    data: {
      registration,
      cardValidUntil: cardValidUntil ? new Date(cardValidUntil) : null,
    },
  });

  revalidatePath(`/carteirinha/${memberId}`);
  return { ok: true };
}

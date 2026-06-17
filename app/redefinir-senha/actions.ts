"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { ok: false, error: "Token inválido." };
  if (password.length < 8)
    return { ok: false, error: "A senha deve ter pelo menos 8 caracteres." };
  if (password !== confirm)
    return { ok: false, error: "As senhas não conferem." };

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record) return { ok: false, error: "Link inválido ou já utilizado." };
  if (record.usedAt) return { ok: false, error: "Este link já foi utilizado." };
  if (record.expiresAt < new Date())
    return { ok: false, error: "Este link expirou. Solicite um novo." };

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, lockoutCount: 0 },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

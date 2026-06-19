"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { passwordSchema } from "@/lib/validations/auth";

export type ActivateResult = { ok: true } | { ok: false; error: string };

export async function verificarMembro(
  email: string,
  cpf: string,
): Promise<{ ok: true; memberId: string; name: string } | { ok: false; error: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCpf = cpf.replace(/\D/g, "");

  const member = await prisma.member.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: "insensitive" },
      cpf: normalizedCpf,
      deletedAt: null,
    },
  });

  if (!member) {
    return { ok: false, error: "Não encontramos nenhum associado com esse e-mail e CPF. Verifique os dados ou entre em contato com o clube." };
  }

  if (member.userId) {
    return { ok: false, error: "Este associado já possui acesso ativado. Use a opção 'Esqueci minha senha' para recuperar o acesso." };
  }

  return { ok: true, memberId: member.id, name: member.fullName };
}

export async function ativarAcesso(
  memberId: string,
  email: string,
  password: string,
): Promise<ActivateResult> {
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) {
    return { ok: false, error: pw.error.issues[0]?.message ?? "Senha inválida." };
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId, deletedAt: null },
  });

  if (!member) return { ok: false, error: "Associado não encontrado." };
  if (member.userId) return { ok: false, error: "Acesso já foi ativado anteriormente." };

  const existingUser = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (existingUser) {
    return { ok: false, error: "Já existe uma conta com este e-mail." };
  }

  const passwordHash = await bcrypt.hash(pw.data, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: member.fullName,
        email: email.trim().toLowerCase(),
        passwordHash,
        role: "ASSOCIADO",
        approved: true,
      },
    });

    await tx.member.update({
      where: { id: memberId },
      data: {
        userId: user.id,
        status: member.status === "INACTIVE" && member.inactiveReason?.includes("Aguardando")
          ? "ACTIVE"
          : member.status,
      },
    });
  });

  return { ok: true };
}

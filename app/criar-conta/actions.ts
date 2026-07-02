"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyNewMember } from "@/lib/messenger";
import { normalizeMember, memberDbError } from "@/lib/member-data";
import { passwordSchema } from "@/lib/validations/auth";
import { type MemberFormValues } from "@/lib/validations/member";

export type SignupResult = { ok: true } | { ok: false; error: string };

// Auto-cadastro público: cria conta ASSOCIADO (pendente de aprovação)
// + cadastro de associado vinculado, numa única transação.
export async function registrarAssociado(
  values: MemberFormValues,
  password: string,
): Promise<SignupResult> {
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) {
    return { ok: false, error: pw.error.issues[0]?.message ?? "Senha inválida" };
  }

  const n = normalizeMember(values);
  if (!n.ok) return { ok: false, error: n.error };

  const email = n.data.email;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Já existe uma conta com este e-mail." };
  }

  try {
    const passwordHash = await bcrypt.hash(pw.data, 12);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: n.data.fullName,
          email,
          passwordHash,
          role: "ASSOCIADO",
          approved: false,
        },
      });

      const agg = await tx.member.aggregate({ _max: { registration: true } });
      const nextReg = (agg._max.registration ?? 999) + 1;

      const member = await tx.member.create({
        data: {
          ...n.data,
          registration: nextReg,
          status: "INACTIVE",
          inactiveReason: "Aguardando aprovação (auto-cadastro)",
          inactiveAt: new Date(),
          userId: user.id,
        },
      });

      const cfg = await tx.systemConfig.findFirst();
      const enrollmentFee = cfg?.enrollmentFee ?? 50;
      const now = new Date();
      await tx.payment.create({
        data: {
          memberId: member.id,
          planId: member.planId ?? null,
          amount: enrollmentFee,
          referenceMonth: now.getMonth() + 1,
          referenceYear: now.getFullYear(),
          status: "PENDENTE",
          dueDate: now,
          notes: "Taxa de inscrição",
        },
      });

      return { user, member };
    });

    await recordAudit({
      userId: result.user.id,
      action: "CREATE",
      entity: "Member",
      entityId: result.member.id,
      metadata: {
        source: "auto-cadastro",
        fullName: result.member.fullName,
        registration: result.member.registration,
      },
    });

    // Aviso à secretaria pelo Mensageiro (best-effort, nunca lança).
    await notifyNewMember({
      memberId: result.member.id,
      memberFullName: result.member.fullName,
      registration: result.member.registration,
      phone: result.member.phone,
      email: result.member.email,
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: memberDbError(e) };
  }
}

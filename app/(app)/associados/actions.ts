"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { parseBrDate } from "@/lib/format";
import { type MemberFormValues } from "@/lib/validations/member";
import {
  normalizeMember as normalize,
  memberDbError as dbError,
} from "@/lib/member-data";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createMember(
  values: MemberFormValues,
): Promise<ActionResult> {
  const session = await auth();
  const n = normalize(values);
  if (!n.ok) return { ok: false, error: n.error };

  try {
    const member = await prisma.$transaction(async (tx) => {
      const agg = await tx.member.aggregate({
        _max: { registration: true },
      });
      const nextReg = (agg._max.registration ?? 999) + 1;
      const created = await tx.member.create({
        data: { ...n.data, registration: nextReg },
      });

      // Lançar taxa de inscrição automaticamente
      const cfg = await tx.systemConfig.findFirst();
      const enrollmentFee = cfg?.enrollmentFee ?? 50;
      const now = new Date();
      await tx.payment.create({
        data: {
          memberId: created.id,
          planId: created.planId ?? null,
          amount: enrollmentFee,
          referenceMonth: now.getMonth() + 1,
          referenceYear: now.getFullYear(),
          status: "PENDENTE",
          dueDate: now,
          notes: "Taxa de inscrição",
        },
      });

      return created;
    });

    await recordAudit({
      userId: session?.user?.id,
      action: "CREATE",
      entity: "Member",
      entityId: member.id,
      metadata: { fullName: member.fullName, registration: member.registration },
    });

    revalidatePath("/associados");
    revalidatePath("/dashboard");
    revalidatePath("/financeiro/pagamentos");
    return { ok: true, id: member.id };
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
}

export async function updateMember(
  id: string,
  values: MemberFormValues,
): Promise<ActionResult> {
  const session = await auth();
  const n = normalize(values);
  if (!n.ok) return { ok: false, error: n.error };

  try {
    const member = await prisma.member.update({
      where: { id },
      data: n.data,
    });

    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "Member",
      entityId: member.id,
      metadata: { fullName: member.fullName },
    });

    revalidatePath("/associados");
    revalidatePath(`/associados/${id}`);
    revalidatePath("/dashboard");
    return { ok: true, id: member.id };
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
}

export async function updateMemberSince(
  id: string,
  dateBr: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!isAdmin(session?.user)) return { ok: false, error: "Sem permissão." };

  const date = parseBrDate(dateBr);
  if (!date) return { ok: false, error: "Data inválida (DD/MM/AAAA)." };

  try {
    await prisma.member.update({ where: { id }, data: { createdAt: date } });
    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "Member",
      entityId: id,
      metadata: { field: "createdAt", value: dateBr },
    });
    revalidatePath(`/associados/${id}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao atualizar a data." };
  }
}

export async function assignDependent(
  titularId: string,
  dependenteId: string,
): Promise<ActionResult> {
  if (titularId === dependenteId)
    return { ok: false, error: "O titular e o dependente precisam ser pessoas diferentes." };

  const session = await auth();

  try {
    const [titular, dependente] = await Promise.all([
      prisma.member.findFirst({
        where: { id: titularId, deletedAt: null },
        include: { plan: true, dependente: true },
      }),
      prisma.member.findFirst({
        where: { id: dependenteId, deletedAt: null },
        include: { plan: true, dependente: true, titular: true },
      }),
    ]);

    if (!titular) return { ok: false, error: "Titular não encontrado." };
    if (!dependente) return { ok: false, error: "Dependente não encontrado." };
    if (!titular.plan?.name.includes("Família"))
      return { ok: false, error: "Apenas titulares com plano Família podem ter dependentes." };
    if (titular.dependente)
      return { ok: false, error: "Este titular já possui um dependente cadastrado." };
    if (dependente.titularId)
      return { ok: false, error: "Este associado já é dependente de outro titular." };
    if (dependente.dependente)
      return { ok: false, error: "Este associado já possui um dependente (seria circular)." };

    await prisma.member.update({
      where: { id: dependenteId },
      data: { titularId, planId: titular.planId },
    });

    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "Member",
      entityId: dependenteId,
      metadata: { action: "assignDependent", titularId },
    });

    revalidatePath(`/associados/${titularId}`);
    revalidatePath(`/associados/${dependenteId}`);
    return { ok: true, id: dependenteId };
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
}

export async function removeDependent(
  titularId: string,
  dependenteId: string,
): Promise<ActionResult> {
  const session = await auth();

  try {
    await prisma.member.update({
      where: { id: dependenteId, titularId },
      data: { titularId: null },
    });

    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "Member",
      entityId: dependenteId,
      metadata: { action: "removeDependent", titularId },
    });

    revalidatePath(`/associados/${titularId}`);
    revalidatePath(`/associados/${dependenteId}`);
    return { ok: true, id: dependenteId };
  } catch {
    return { ok: false, error: "Erro ao remover dependente." };
  }
}

export async function softDeleteMember(
  id: string,
  reason: string,
  exitDateStr: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!isAdmin(session?.user))
    return { ok: false, error: "Apenas administradores podem desativar associados." };

  const exitDate = parseBrDate(exitDateStr) ?? new Date();

  try {
    await prisma.member.update({
      where: { id },
      data: {
        status: "INACTIVE",
        inactiveReason: reason.trim() || null,
        inactiveAt: exitDate,
      },
    });

    await recordAudit({
      userId: session?.user?.id,
      action: "DELETE",
      entity: "Member",
      entityId: id,
      metadata: { reason: reason.trim(), exitDate: exitDateStr },
    });

    revalidatePath("/associados");
    revalidatePath("/dashboard");
    return { ok: true, id };
  } catch (e) {
    console.error("[softDeleteMember]", e);
    return { ok: false, error: dbError(e) };
  }
}

export async function changeMemberPassword(
  memberId: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!isAdmin(session?.user)) return { ok: false, error: "Sem permissão." };

  if (newPassword.length < 6)
    return { ok: false, error: "A senha deve ter pelo menos 6 caracteres." };

  const member = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
    select: { userId: true, fullName: true },
  });
  if (!member) return { ok: false, error: "Associado não encontrado." };
  if (!member.userId)
    return { ok: false, error: "Este associado não possui conta de acesso cadastrada." };

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: member.userId },
    data: { passwordHash },
  });

  await recordAudit({
    userId: session?.user?.id,
    action: "UPDATE",
    entity: "User",
    entityId: member.userId,
    metadata: { action: "password_changed_by_admin", memberId },
  });

  return { ok: true };
}

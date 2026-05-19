"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { parseBrDate } from "@/lib/format";
import { planSchema, type PlanFormValues, transactionSchema, type TransactionFormValues } from "@/lib/validations/finance";

type Result = { ok: boolean; error?: string };

export async function savePlan(
  values: PlanFormValues,
  id?: string,
): Promise<Result> {
  const session = await auth();
  const parsed = planSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  }
  const d = parsed.data;
  const data = {
    name: d.name,
    monthlyPrice: d.monthlyPrice,
    billingPeriod: d.billingPeriod,
    description: d.description || null,
    active: d.active,
  };

  try {
    const plan = id
      ? await prisma.plan.update({ where: { id }, data })
      : await prisma.plan.create({ data });
    await recordAudit({
      userId: session?.user?.id,
      action: id ? "UPDATE" : "CREATE",
      entity: "Plan",
      entityId: plan.id,
    });
    revalidatePath("/financeiro/planos");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao salvar o plano." };
  }
}

export async function togglePlan(id: string): Promise<Result> {
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) return { ok: false, error: "Plano não encontrado." };
  await prisma.plan.update({
    where: { id },
    data: { active: !plan.active },
  });
  revalidatePath("/financeiro/planos");
  return { ok: true };
}

export async function deletePlan(id: string): Promise<Result> {
  const session = await auth();
  const usage = await prisma.member.count({ where: { planId: id } });
  if (usage > 0) {
    return {
      ok: false,
      error: "Plano em uso por associados. Desative-o em vez de excluir.",
    };
  }
  try {
    await prisma.payment.deleteMany({ where: { planId: id } });
    await prisma.plan.delete({ where: { id } });
    await recordAudit({
      userId: session?.user?.id,
      action: "DELETE",
      entity: "Plan",
      entityId: id,
    });
    revalidatePath("/financeiro/planos");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao excluir o plano." };
  }
}

// Lança a mensalidade do mês/ano para todos os associados ativos com plano
export async function launchMonthly(
  month: number,
  year: number,
): Promise<{ ok: boolean; created: number; error?: string }> {
  const session = await auth();
  const members = await prisma.member.findMany({
    where: { deletedAt: null, status: "ACTIVE", planId: { not: null } },
    include: { plan: true },
  });

  let created = 0;
  for (const m of members) {
    const exists = await prisma.payment.findUnique({
      where: {
        memberId_referenceMonth_referenceYear: {
          memberId: m.id,
          referenceMonth: month,
          referenceYear: year,
        },
      },
    });
    if (exists) continue;
    await prisma.payment.create({
      data: {
        memberId: m.id,
        planId: m.planId,
        amount: m.plan?.monthlyPrice ?? 0,
        referenceMonth: month,
        referenceYear: year,
        status: "PENDENTE",
        dueDate: new Date(Date.UTC(year, month - 1, 10)),
      },
    });
    created++;
  }

  await recordAudit({
    userId: session?.user?.id,
    action: "CREATE",
    entity: "Payment",
    entityId: `batch-${month}-${year}`,
    metadata: { created, month, year },
  });
  revalidatePath("/financeiro/pagamentos");
  revalidatePath("/financeiro");
  return { ok: true, created };
}

export async function markAsPaid(
  id: string,
  paidAt?: Date,
  notes?: string,
): Promise<{ ok: true; receiptNumber: string } | { ok: false; error: string }> {
  const session = await auth();
  try {
    const resolvedDate = paidAt ?? new Date();
    const year = resolvedDate.getFullYear();

    const updated = await prisma.$transaction(async (tx) => {
      const count = await tx.payment.count({
        where: { receiptNumber: { startsWith: `${year}-` } },
      });
      const receiptNumber = `${year}-${String(count + 1).padStart(4, "0")}`;
      return tx.payment.update({
        where: { id },
        data: {
          status: "PAGO",
          paidAt: resolvedDate,
          notes: notes?.trim() || null,
          receiptNumber,
        },
      });
    });

    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "Payment",
      entityId: id,
      metadata: { status: "PAGO", receiptNumber: updated.receiptNumber },
    });
    revalidatePath("/financeiro/pagamentos");
    revalidatePath("/financeiro");
    return { ok: true, receiptNumber: updated.receiptNumber! };
  } catch {
    return { ok: false, error: "Erro ao registrar pagamento." };
  }
}

export async function cancelPayment(id: string): Promise<Result> {
  const session = await auth();
  try {
    await prisma.payment.delete({ where: { id } });
    await recordAudit({
      userId: session?.user?.id,
      action: "DELETE",
      entity: "Payment",
      entityId: id,
    });
    revalidatePath("/financeiro/pagamentos");
    revalidatePath("/financeiro");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao cancelar o pagamento." };
  }
}

export async function setPaymentStatus(
  id: string,
  status: "PAGO" | "PENDENTE" | "ATRASADO",
): Promise<Result> {
  const session = await auth();
  try {
    await prisma.payment.update({
      where: { id },
      data: {
        status,
        paidAt: status === "PAGO" ? new Date() : null,
      },
    });
    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "Payment",
      entityId: id,
      metadata: { status },
    });
    revalidatePath("/financeiro/pagamentos");
    revalidatePath("/financeiro");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao atualizar o pagamento." };
  }
}

// ─── System Config ───────────────────────────────────────────────────────────

export async function getSystemConfig() {
  let cfg = await prisma.systemConfig.findFirst();
  if (!cfg) cfg = await prisma.systemConfig.create({ data: {} });
  return cfg;
}

export async function saveEnrollmentFee(fee: number): Promise<Result> {
  const session = await auth();
  if (fee < 0) return { ok: false, error: "O valor não pode ser negativo." };
  try {
    const cfg = await getSystemConfig();
    await prisma.systemConfig.update({
      where: { id: cfg.id },
      data: { enrollmentFee: fee },
    });
    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "SystemConfig",
      entityId: cfg.id,
      metadata: { enrollmentFee: fee },
    });
    revalidatePath("/financeiro/planos");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao salvar a taxa de inscrição." };
  }
}

// ─── Transactions (Entrada / Saída) ──────────────────────────────────────────

export async function saveTransaction(
  values: TransactionFormValues,
  id?: string,
): Promise<Result> {
  const session = await auth();
  const parsed = transactionSchema.safeParse(values);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };

  const d = parsed.data;
  const date = parseBrDate(d.date);
  if (!date) return { ok: false, error: "Data inválida." };

  const data = {
    type: d.type,
    category: d.category,
    description: d.description,
    amount: d.amount,
    date,
    notes: d.notes?.trim() || null,
  };

  try {
    const tx = id
      ? await prisma.transaction.update({ where: { id }, data })
      : await prisma.transaction.create({ data });

    await recordAudit({
      userId: session?.user?.id,
      action: id ? "UPDATE" : "CREATE",
      entity: "Transaction",
      entityId: tx.id,
      metadata: { type: tx.type, amount: tx.amount },
    });

    revalidatePath("/financeiro/caixa");
    revalidatePath("/financeiro");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao salvar a transação." };
  }
}

export async function deleteTransaction(id: string): Promise<Result> {
  const session = await auth();
  try {
    await prisma.transaction.delete({ where: { id } });
    await recordAudit({
      userId: session?.user?.id,
      action: "DELETE",
      entity: "Transaction",
      entityId: id,
    });
    revalidatePath("/financeiro/caixa");
    revalidatePath("/financeiro");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao excluir a transação." };
  }
}

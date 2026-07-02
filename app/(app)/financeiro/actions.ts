"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { parseBrDate } from "@/lib/format";
import { asaasConfigured, asaasCancelCharge } from "@/lib/asaas";
import { notifyPaymentConfirmed } from "@/lib/messenger";
import { generateReceiptNumber } from "@/lib/receipt";
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

// Lança mensalidades de um intervalo de meses para um único associado
export async function launchMemberMonthlyRange(
  memberId: string,
  fromMonth: number,
  fromYear: number,
  toMonth: number,
  toYear: number,
): Promise<{ ok: boolean; created: number; skipped: number; error?: string }> {
  const session = await auth();

  const member = await prisma.member.findUnique({
    where: { id: memberId, deletedAt: null },
    include: { plan: true },
  });
  if (!member) return { ok: false, created: 0, skipped: 0, error: "Associado não encontrado." };
  if (!member.plan) return { ok: false, created: 0, skipped: 0, error: "Associado sem plano vinculado." };

  // Gera lista de meses no intervalo
  const months: { month: number; year: number }[] = [];
  let m = fromMonth, y = fromYear;
  while (y < toYear || (y === toYear && m <= toMonth)) {
    months.push({ month: m, year: y });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  let created = 0, skipped = 0;
  for (const { month, year } of months) {
    const exists = await prisma.payment.findUnique({
      where: { memberId_referenceMonth_referenceYear: { memberId, referenceMonth: month, referenceYear: year } },
    });
    if (exists) { skipped++; continue; }
    await prisma.payment.create({
      data: {
        memberId,
        planId: member.planId,
        amount: member.plan.monthlyPrice,
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
    entityId: `range-${memberId}-${fromMonth}/${fromYear}-${toMonth}/${toYear}`,
    metadata: { created, skipped, memberId },
  });
  revalidatePath("/financeiro/pagamentos");
  revalidatePath("/financeiro");
  return { ok: true, created, skipped };
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
      const receiptNumber = await generateReceiptNumber(tx, year);
      return tx.payment.update({
        where: { id },
        data: {
          status: "PAGO",
          paidAt: resolvedDate,
          ...(notes?.trim() ? { notes: notes.trim() } : {}),
          receiptNumber,
          confirmedVia: "MANUAL",
        },
        include: {
          member: { select: { id: true, fullName: true, whatsapp: true, phone: true } },
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

    // Aviso ao associado pelo Mensageiro (best-effort, nunca lança).
    await notifyPaymentConfirmed({
      memberId: updated.member.id,
      memberFullName: updated.member.fullName,
      memberWhatsapp: updated.member.whatsapp,
      memberPhone: updated.member.phone,
      amount: updated.amount,
      referenceMonth: updated.referenceMonth,
      referenceYear: updated.referenceYear,
      receiptNumber: updated.receiptNumber!,
    });

    revalidatePath("/financeiro/pagamentos");
    revalidatePath("/financeiro");
    return { ok: true, receiptNumber: updated.receiptNumber! };
  } catch {
    return { ok: false, error: "Erro ao registrar pagamento." };
  }
}

export async function rejectReceipt(id: string): Promise<Result> {
  const session = await auth();
  try {
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return { ok: false, error: "Pagamento não encontrado." };
    await prisma.payment.update({
      where: { id },
      data: {
        status: payment.dueDate < new Date() ? "ATRASADO" : "PENDENTE",
        receiptPath: null,
        receiptSubmittedAt: null,
      },
    });
    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "Payment",
      entityId: id,
      metadata: { action: "receipt_rejected" },
    });
    revalidatePath("/financeiro/pagamentos");
    revalidatePath("/meu-espaco");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao rejeitar o comprovante." };
  }
}

export async function editPayment(
  id: string,
  values: {
    amount: number;
    dueDate: string; // DD/MM/YYYY
    referenceMonth: number;
    referenceYear: number;
    status: "PAGO" | "PENDENTE" | "ATRASADO";
    notes?: string;
  },
): Promise<Result> {
  const session = await auth();
  if (!values.amount || values.amount <= 0) return { ok: false, error: "Valor inválido." };
  const due = parseBrDate(values.dueDate);
  if (!due) return { ok: false, error: "Data de vencimento inválida." };
  try {
    const current = await prisma.payment.findUnique({
      where: { id },
      include: { member: { select: { id: true, fullName: true, whatsapp: true, phone: true } } },
    });
    if (!current) return { ok: false, error: "Pagamento não encontrado." };

    // Só notifica quando o pagamento passa a PAGO (não a cada edição de um já pago).
    const becomingPaid = values.status === "PAGO" && current.status !== "PAGO";

    // Valor ou vencimento mudou com uma cobrança Asaas já gerada: invalida o cache
    // (e tenta cancelar a cobrança antiga) pra próxima abertura gerar uma nova com os dados corretos.
    const amountOrDueChanged =
      current.amount !== values.amount || current.dueDate.getTime() !== due.getTime();
    if (amountOrDueChanged && current.asaasChargeId) {
      await asaasCancelCharge(current.asaasChargeId).catch(() => {});
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Gera número de recibo se está virando PAGO e ainda não tem um.
      let receiptNumber = current.receiptNumber;
      if (becomingPaid && !receiptNumber) {
        receiptNumber = await generateReceiptNumber(tx, new Date().getFullYear());
      }
      return tx.payment.update({
        where: { id },
        data: {
          amount: values.amount,
          dueDate: due,
          referenceMonth: values.referenceMonth,
          referenceYear: values.referenceYear,
          status: values.status,
          paidAt: values.status === "PAGO" ? current.paidAt ?? new Date() : null,
          notes: values.notes?.trim() || null,
          confirmedVia: values.status === "PAGO" ? (current.confirmedVia ?? "MANUAL") : current.confirmedVia,
          receiptNumber,
          ...(amountOrDueChanged && current.asaasChargeId
            ? {
                asaasChargeId: null,
                asaasPixPayload: null,
                asaasPixQrCode: null,
                asaasPixExpiresAt: null,
              }
            : {}),
        },
      });
    });
    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "Payment",
      entityId: id,
      metadata: { amount: values.amount, status: values.status },
    });

    // Baixa manual via "Editar" também avisa o associado pelo Mensageiro.
    if (becomingPaid) {
      await notifyPaymentConfirmed({
        memberId: current.member.id,
        memberFullName: current.member.fullName,
        memberWhatsapp: current.member.whatsapp,
        memberPhone: current.member.phone,
        amount: updated.amount,
        referenceMonth: updated.referenceMonth,
        referenceYear: updated.referenceYear,
        receiptNumber: updated.receiptNumber ?? "",
      });
    }

    revalidatePath("/financeiro/pagamentos");
    revalidatePath("/financeiro");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao editar o pagamento." };
  }
}

export async function cancelPayment(id: string): Promise<Result> {
  const session = await auth();
  try {
    const payment = await prisma.payment.findUnique({ where: { id }, select: { asaasChargeId: true } });
    if (payment?.asaasChargeId) {
      await asaasCancelCharge(payment.asaasChargeId).catch(() => {});
    }
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

export type BillingConfigValues = {
  billingMode: "MANUAL" | "ASAAS";
  pixKey: string;
  pixKeyType: string;
  pixCity: string;
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  accountHolderName: string;
  financeiroWhatsapp: string;
};

export async function saveBillingConfig(
  values: BillingConfigValues,
): Promise<Result> {
  const session = await auth();
  if (values.billingMode === "ASAAS" && !asaasConfigured()) {
    return {
      ok: false,
      error: "Configure a integração Asaas no servidor (ASAAS_API_KEY / ASAAS_ENV) antes de ativar o modo automático.",
    };
  }
  try {
    const cfg = await getSystemConfig();
    await prisma.systemConfig.update({
      where: { id: cfg.id },
      data: {
        billingMode: values.billingMode,
        pixKey: values.pixKey.trim() || null,
        pixKeyType: values.pixKeyType.trim() || null,
        pixCity: values.pixCity.trim() || null,
        bankName: values.bankName.trim() || null,
        bankAgency: values.bankAgency.trim() || null,
        bankAccount: values.bankAccount.trim() || null,
        accountHolderName: values.accountHolderName.trim() || null,
        financeiroWhatsapp: values.financeiroWhatsapp.trim() || null,
      },
    });
    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "SystemConfig",
      entityId: cfg.id,
      metadata: { pixKey: values.pixKey },
    });
    revalidatePath("/configuracoes/cobranca");
    revalidatePath("/meu-espaco");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao salvar os dados de cobrança." };
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
    subcategory: d.subcategory?.trim() || null,
    description: d.description,
    amount: d.amount,
    date,
    competenceMonth: d.competenceMonth ?? null,
    competenceYear: d.competenceYear ?? null,
    clubAccount: d.clubAccount?.trim() || null,
    payerName: d.payerName?.trim() || null,
    linkedActivity: d.linkedActivity?.trim() || null,
    paymentMethod: d.paymentMethod?.trim() || null,
    notes: d.notes?.trim() || null,
    supplierId:     d.supplierId?.trim() || null,
    attachmentUrl:  d.attachmentUrl?.trim() || null,
    attachmentName: d.attachmentName?.trim() || null,
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

// ─── Transaction Categories ───────────────────────────────────────────────────

export type CategoryWithSubs = {
  id: string;
  type: string;
  name: string;
  order: number;
  subcategories: { id: string; name: string; order: number }[];
};

export async function getTransactionCategories(): Promise<{
  ENTRADA: CategoryWithSubs[];
  SAIDA: CategoryWithSubs[];
}> {
  await initDefaultCategories();
  const cats = await prisma.transactionCategory.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      subcategories: { orderBy: [{ order: "asc" }, { name: "asc" }] },
    },
  });
  return {
    ENTRADA: cats.filter((c) => c.type === "ENTRADA"),
    SAIDA: cats.filter((c) => c.type === "SAIDA"),
  };
}

async function initDefaultCategories() {
  const count = await prisma.transactionCategory.count();
  if (count > 0) return;

  const defaults: { type: string; name: string; subs: string[] }[] = [
    { type: "ENTRADA", name: "Mensalidade", subs: ["Mensalidade Sócio Efetivo", "Mensalidade Sócio Familiar", "Mensalidade Estudante", "Taxa de Inscrição", "Regularização de débito"] },
    { type: "ENTRADA", name: "Inscrições", subs: ["Trilha / Caminhada", "Escalada", "Curso de montanhismo", "Bike", "Campanha ecológica", "Outro evento"] },
    { type: "ENTRADA", name: "Patrocínio", subs: ["Pessoa Física", "Empresa", "Apoio Institucional"] },
    { type: "ENTRADA", name: "Projetos ambientais", subs: ["Edital público", "Convênio", "Doação vinculada"] },
    { type: "ENTRADA", name: "Outros", subs: ["Doação avulsa", "Multa / Ressarcimento", "Receita diversa"] },
    { type: "SAIDA", name: "Manutenção", subs: [] },
    { type: "SAIDA", name: "Material", subs: [] },
    { type: "SAIDA", name: "Equipamento", subs: [] },
    { type: "SAIDA", name: "Evento / Trilha", subs: [] },
    { type: "SAIDA", name: "Administrativo", subs: [] },
    { type: "SAIDA", name: "Sede", subs: [] },
    { type: "SAIDA", name: "Outros", subs: [] },
  ];

  for (let i = 0; i < defaults.length; i++) {
    const d = defaults[i];
    const cat = await prisma.transactionCategory.create({
      data: { type: d.type, name: d.name, order: i },
    });
    for (let j = 0; j < d.subs.length; j++) {
      await prisma.transactionSubcategory.create({
        data: { categoryId: cat.id, name: d.subs[j], order: j },
      });
    }
  }
}

export async function createTransactionCategory(
  type: "ENTRADA" | "SAIDA",
  name: string,
): Promise<Result> {
  const session = await auth();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Informe o nome da categoria." };
  try {
    const count = await prisma.transactionCategory.count({ where: { type } });
    await prisma.transactionCategory.create({ data: { type, name: trimmed, order: count } });
    await recordAudit({
      userId: session?.user?.id,
      action: "CREATE",
      entity: "TransactionCategory",
      entityId: trimmed,
    });
    revalidatePath("/financeiro/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Já existe uma categoria com este nome." };
  }
}

export async function deleteTransactionCategory(id: string): Promise<Result> {
  const session = await auth();
  try {
    const cat = await prisma.transactionCategory.findUnique({ where: { id } });
    if (!cat) return { ok: false, error: "Categoria não encontrada." };
    await prisma.transactionCategory.delete({ where: { id } });
    await recordAudit({
      userId: session?.user?.id,
      action: "DELETE",
      entity: "TransactionCategory",
      entityId: id,
      metadata: { name: cat.name },
    });
    revalidatePath("/financeiro/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao excluir a categoria." };
  }
}

export async function createTransactionSubcategory(
  categoryId: string,
  name: string,
): Promise<Result> {
  const session = await auth();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Informe o nome da subcategoria." };
  try {
    const count = await prisma.transactionSubcategory.count({ where: { categoryId } });
    await prisma.transactionSubcategory.create({ data: { categoryId, name: trimmed, order: count } });
    await recordAudit({
      userId: session?.user?.id,
      action: "CREATE",
      entity: "TransactionSubcategory",
      entityId: trimmed,
    });
    revalidatePath("/financeiro/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Já existe uma subcategoria com este nome." };
  }
}

export async function deleteTransactionSubcategory(id: string): Promise<Result> {
  const session = await auth();
  try {
    const sub = await prisma.transactionSubcategory.findUnique({ where: { id } });
    if (!sub) return { ok: false, error: "Subcategoria não encontrada." };
    await prisma.transactionSubcategory.delete({ where: { id } });
    await recordAudit({
      userId: session?.user?.id,
      action: "DELETE",
      entity: "TransactionSubcategory",
      entityId: id,
      metadata: { name: sub.name },
    });
    revalidatePath("/financeiro/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao excluir a subcategoria." };
  }
}

export async function renameTransactionCategory(id: string, name: string): Promise<Result> {
  const session = await auth();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Informe o nome da categoria." };
  try {
    await prisma.transactionCategory.update({ where: { id }, data: { name: trimmed } });
    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "TransactionCategory",
      entityId: id,
      metadata: { name: trimmed },
    });
    revalidatePath("/financeiro/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Já existe uma categoria com este nome." };
  }
}

export async function renameTransactionSubcategory(id: string, name: string): Promise<Result> {
  const session = await auth();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Informe o nome da subcategoria." };
  try {
    await prisma.transactionSubcategory.update({ where: { id }, data: { name: trimmed } });
    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "TransactionSubcategory",
      entityId: id,
      metadata: { name: trimmed },
    });
    revalidatePath("/financeiro/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Já existe uma subcategoria com este nome." };
  }
}

export async function reorderTransactionCategories(
  type: "ENTRADA" | "SAIDA",
  orderedIds: string[],
): Promise<Result> {
  try {
    await prisma.$transaction(
      orderedIds.map((id, i) =>
        prisma.transactionCategory.update({ where: { id }, data: { order: i } }),
      ),
    );
    revalidatePath("/financeiro/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao reordenar categorias." };
  }
}

export async function reorderTransactionSubcategories(
  categoryId: string,
  orderedIds: string[],
): Promise<Result> {
  try {
    await prisma.$transaction(
      orderedIds.map((id, i) =>
        prisma.transactionSubcategory.update({ where: { id }, data: { order: i } }),
      ),
    );
    revalidatePath("/financeiro/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao reordenar subcategorias." };
  }
}

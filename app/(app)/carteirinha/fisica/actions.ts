"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { notifyCardRequest } from "@/lib/messenger";
import {
  checkEligibility,
  currentQuarter,
  type PhysicalCardStage,
} from "@/lib/physical-card";

async function adminLabel(): Promise<string> {
  const session = await requireAdmin();
  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: { name: true, email: true },
  });
  return dbUser?.name ?? dbUser?.email ?? session.id;
}

async function addHistory(
  requestId: string,
  fromStage: string | null,
  toStage: string,
  changedBy: string,
  payload?: Record<string, unknown>,
) {
  await prisma.physicalCardStatusHistory.create({
    data: {
      requestId,
      fromStage,
      toStage,
      changedBy,
      payload: payload ? JSON.stringify(payload) : null,
    },
  });
}

// ---------------------------------------------------------------------------
// Etapa 01 — Abrir solicitação
// ---------------------------------------------------------------------------
export async function createRequest(memberId: string) {
  const user = await requireAdmin();

  const member = await prisma.member.findUnique({
    where: { id: memberId, deletedAt: null },
    include: {
      eventRegistrations: {
        include: {
          event: { select: { name: true, dateTime: true, status: true, eventCategory: true } },
        },
      },
    },
  });
  if (!member) return { error: "Associado não encontrado." };

  const { quarter, year } = currentQuarter();

  const existing = await prisma.physicalCardRequest.findUnique({
    where: { memberId_quarter_year_requestType: { memberId, quarter, year, requestType: "PRIMEIRA_VIA" } },
  });
  if (existing) {
    return { error: "Já existe uma solicitação para este associado no trimestre atual." };
  }

  // Bloquear se houver pagamentos pendentes ou atrasados
  const pendingPayments = await prisma.payment.count({
    where: { memberId, status: { in: ["PENDENTE", "ATRASADO"] } },
  });
  if (pendingPayments > 0) {
    return {
      error: `Associado possui ${pendingPayments} pagamento(s) pendente(s) ou atrasado(s). Regularize a situação financeira antes de solicitar a carteirinha física.`,
    };
  }

  const eligibility = checkEligibility(member.createdAt, member.eventRegistrations);
  if (!eligibility.isEligible) {
    return {
      error: "Associado não atende aos critérios de elegibilidade.",
      eligibility,
    };
  }

  try {
    const request = await prisma.physicalCardRequest.create({
      data: {
        memberId,
        currentStage: "minimum_requirements" as PhysicalCardStage,
        eligibilitySnapshot: JSON.stringify(eligibility),
        quarter,
        year,
      },
    });

    const label = await adminLabel();
    await addHistory(request.id, null, "minimum_requirements", label);

    await recordAudit({
      userId: user.id,
      action: "CREATE",
      entity: "PhysicalCardRequest",
      entityId: request.id,
      metadata: { memberId, quarter, year },
    });

    // Aviso à secretaria pelo Mensageiro (best-effort, nunca lança).
    await notifyCardRequest({
      memberId,
      memberFullName: member.fullName,
      tipo: "1ª via",
    });

    revalidatePath("/carteirinha/fisica");
    return { ok: true, requestId: request.id };
  } catch {
    return { error: "Erro ao criar solicitação." };
  }
}

// ---------------------------------------------------------------------------
// Etapa 01 — Abrir solicitações em lote
// ---------------------------------------------------------------------------
export async function createRequestBatch(memberIds: string[]) {
  const user = await requireAdmin();
  const label = await adminLabel();
  const { quarter, year } = currentQuarter();

  const members = await prisma.member.findMany({
    where: { id: { in: memberIds }, deletedAt: null },
    include: {
      eventRegistrations: {
        include: {
          event: { select: { name: true, dateTime: true, status: true, eventCategory: true } },
        },
      },
    },
  });

  let created = 0;
  const errors: { name: string; reason: string }[] = [];

  for (const member of members) {
    const existing = await prisma.physicalCardRequest.findUnique({
      where: { memberId_quarter_year_requestType: { memberId: member.id, quarter, year, requestType: "PRIMEIRA_VIA" } },
    });
    if (existing) {
      errors.push({ name: member.fullName, reason: "Já possui solicitação no trimestre." });
      continue;
    }

    // Bloquear se houver pagamentos pendentes ou atrasados
    const pendingPayments = await prisma.payment.count({
      where: { memberId: member.id, status: { in: ["PENDENTE", "ATRASADO"] } },
    });
    if (pendingPayments > 0) {
      errors.push({ name: member.fullName, reason: `${pendingPayments} pagamento(s) pendente(s) ou atrasado(s).` });
      continue;
    }

    const eligibility = checkEligibility(member.createdAt, member.eventRegistrations);
    if (!eligibility.isEligible) {
      errors.push({ name: member.fullName, reason: "Não atende aos critérios de elegibilidade." });
      continue;
    }

    try {
      const request = await prisma.physicalCardRequest.create({
        data: {
          memberId: member.id,
          currentStage: "minimum_requirements" as PhysicalCardStage,
          eligibilitySnapshot: JSON.stringify(eligibility),
          quarter,
          year,
        },
      });
      await addHistory(request.id, null, "minimum_requirements", label);
      await recordAudit({
        userId: user.id,
        action: "CREATE",
        entity: "PhysicalCardRequest",
        entityId: request.id,
        metadata: { memberId: member.id, quarter, year, batch: true },
      });
      created++;
    } catch {
      errors.push({ name: member.fullName, reason: "Erro interno ao criar." });
    }
  }

  revalidatePath("/carteirinha/fisica");
  return { ok: true, created, skipped: errors.length, errors };
}

// ---------------------------------------------------------------------------
// Etapa 02 — Aprovar
// ---------------------------------------------------------------------------
export async function approveRequest(id: string, notes?: string) {
  const user = await requireAdmin();
  const label = await adminLabel();

  const req = await prisma.physicalCardRequest.findUnique({ where: { id } });
  if (!req) return { error: "Solicitação não encontrada." };
  if (req.currentStage !== "minimum_requirements") {
    return { error: "Somente solicitações na etapa de exigências podem ser aprovadas." };
  }

  try {
    await prisma.physicalCardRequest.update({
      where: { id },
      data: {
        currentStage: "issuance_pending",
        approvedBy: label,
        approvedAt: new Date(),
        approvedNotes: notes ?? null,
      },
    });

    await addHistory(id, "minimum_requirements", "issuance_pending", label, { notes });

    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "PhysicalCardRequest",
      entityId: id,
      metadata: { action: "approve", notes },
    });

    revalidatePath("/carteirinha/fisica");
    revalidatePath(`/carteirinha/fisica/${id}`);
    return { ok: true };
  } catch {
    return { error: "Erro ao aprovar solicitação." };
  }
}

// ---------------------------------------------------------------------------
// Etapa 02 — Reprovar
// ---------------------------------------------------------------------------
const rejectSchema = z.object({
  reason: z.string().min(5, "Informe o motivo da reprovação (mínimo 5 caracteres)."),
});

export async function rejectRequest(id: string, reason: string) {
  const user = await requireAdmin();
  const label = await adminLabel();

  const parsed = rejectSchema.safeParse({ reason });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Motivo inválido." };

  const req = await prisma.physicalCardRequest.findUnique({ where: { id } });
  if (!req) return { error: "Solicitação não encontrada." };
  if (req.currentStage !== "minimum_requirements") {
    return { error: "Somente solicitações na etapa de exigências podem ser reprovadas." };
  }

  try {
    await prisma.physicalCardRequest.update({
      where: { id },
      data: { currentStage: "rejected", rejectedReason: reason },
    });

    await addHistory(id, "minimum_requirements", "rejected", label, { reason });

    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "PhysicalCardRequest",
      entityId: id,
      metadata: { action: "reject", reason },
    });

    revalidatePath("/carteirinha/fisica");
    revalidatePath(`/carteirinha/fisica/${id}`);
    return { ok: true };
  } catch {
    return { error: "Erro ao reprovar solicitação." };
  }
}

// ---------------------------------------------------------------------------
// Etapa 03 — Marcar como emitida (individual ou em lote)
// ---------------------------------------------------------------------------
const issueSchema = z.object({
  ids: z.array(z.string()).min(1),
  issuedAt: z.string().optional(),
});

export async function markAsIssued(ids: string[], issuedAt?: string) {
  const user = await requireAdmin();
  const label = await adminLabel();

  const parsed = issueSchema.safeParse({ ids, issuedAt });
  if (!parsed.success) return { error: "Dados inválidos." };

  const issuedDate = issuedAt ? new Date(issuedAt) : new Date();

  try {
    await prisma.$transaction(async (tx) => {
      for (const id of ids) {
        const req = await tx.physicalCardRequest.findUnique({ where: { id } });
        if (!req || req.currentStage !== "issuance_pending") continue;

        await tx.physicalCardRequest.update({
          where: { id },
          data: { currentStage: "in_production", issuedAt: issuedDate },
        });

        await tx.physicalCardStatusHistory.create({
          data: {
            requestId: id,
            fromStage: "issuance_pending",
            toStage: "in_production",
            changedBy: label,
            payload: JSON.stringify({ issuedAt: issuedDate.toISOString() }),
          },
        });
      }
    });

    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "PhysicalCardRequest",
      entityId: ids.join(","),
      metadata: { action: "issue_batch", count: ids.length, issuedAt: issuedDate.toISOString() },
    });

    revalidatePath("/carteirinha/fisica");
    return { ok: true, count: ids.length };
  } catch {
    return { error: "Erro ao marcar como emitida." };
  }
}

// ---------------------------------------------------------------------------
// Etapa 04 — Marcar como aguardando retirada
// ---------------------------------------------------------------------------
export async function markAsReadyForPickup(id: string) {
  const user = await requireAdmin();
  const label = await adminLabel();

  const req = await prisma.physicalCardRequest.findUnique({
    where: { id },
    include: { member: { select: { phone: true, whatsapp: true, fullName: true } } },
  });
  if (!req) return { error: "Solicitação não encontrada." };
  if (req.currentStage !== "in_production") {
    return { error: "Solicitação não está em produção." };
  }

  try {
    await prisma.physicalCardRequest.update({
      where: { id },
      data: { currentStage: "awaiting_pickup", readyAt: new Date() },
    });

    await addHistory(id, "in_production", "awaiting_pickup", label);

    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "PhysicalCardRequest",
      entityId: id,
      metadata: { action: "ready_for_pickup" },
    });

    revalidatePath("/carteirinha/fisica");
    revalidatePath(`/carteirinha/fisica/${id}`);

    // Retorna o link WhatsApp para o admin notificar manualmente
    const phone = req.member.whatsapp ?? req.member.phone;
    const msg = encodeURIComponent(
      `Olá, ${req.member.fullName}! Sua carteirinha física do CEF está disponível para retirada na sede.`,
    );
    const whatsappLink = phone
      ? `https://wa.me/55${phone.replace(/\D/g, "")}?text=${msg}`
      : null;

    return { ok: true, whatsappLink };
  } catch {
    return { error: "Erro ao atualizar status." };
  }
}

// ---------------------------------------------------------------------------
// Etapa 05 — Entregar
// ---------------------------------------------------------------------------
const deliverSchema = z.object({
  deliveredAt: z.string().min(1),
  receivedBy: z.string().optional(),
  notes: z.string().optional(),
});

export async function deliverCard(id: string, data: unknown) {
  const user = await requireAdmin();
  const label = await adminLabel();

  const parsed = deliverSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const req = await prisma.physicalCardRequest.findUnique({ where: { id } });
  if (!req) return { error: "Solicitação não encontrada." };
  if (req.currentStage !== "awaiting_pickup") {
    return { error: "Carteirinha não está aguardando retirada." };
  }

  const { deliveredAt, receivedBy, notes } = parsed.data;

  try {
    await prisma.physicalCardRequest.update({
      where: { id },
      data: {
        currentStage: "delivered",
        deliveredAt: new Date(deliveredAt),
        receivedBy: receivedBy || null,
        deliveryNotes: notes || null,
        deliveredBy: label,
      },
    });

    await addHistory(id, "awaiting_pickup", "delivered", label, {
      deliveredAt,
      receivedBy,
      notes,
    });

    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "PhysicalCardRequest",
      entityId: id,
      metadata: { action: "deliver", deliveredAt, receivedBy, notes },
    });

    revalidatePath("/carteirinha/fisica");
    revalidatePath(`/carteirinha/fisica/${id}`);
    return { ok: true };
  } catch {
    return { error: "Erro ao registrar entrega." };
  }
}

// ---------------------------------------------------------------------------
// Segunda via — Abrir solicitação (pula elegibilidade, cobra R$30)
// ---------------------------------------------------------------------------
export async function createSecondCopyRequest(memberId: string) {
  const user = await requireAdmin();

  const member = await prisma.member.findUnique({
    where: { id: memberId, deletedAt: null },
    select: { id: true, fullName: true },
  });
  if (!member) return { error: "Associado não encontrado." };

  // Bloquear se houver pagamentos pendentes ou atrasados
  const pendingPayments = await prisma.payment.count({
    where: { memberId, status: { in: ["PENDENTE", "ATRASADO"] } },
  });
  if (pendingPayments > 0) {
    return {
      error: `Associado possui ${pendingPayments} pagamento(s) pendente(s) ou atrasado(s). Regularize a situação financeira antes de solicitar a 2ª via.`,
    };
  }

  const { quarter, year } = currentQuarter();

  const existing = await prisma.physicalCardRequest.findUnique({
    where: { memberId_quarter_year_requestType: { memberId, quarter, year, requestType: "SEGUNDA_VIA" } },
  });
  if (existing) {
    return { error: "Já existe uma solicitação de 2ª via para este associado no trimestre atual." };
  }

  try {
    const request = await prisma.physicalCardRequest.create({
      data: {
        memberId,
        requestType: "SEGUNDA_VIA",
        currentStage: "payment_pending" as PhysicalCardStage,
        eligibilitySnapshot: JSON.stringify({ secondCopy: true }),
        paymentAmount: 30,
        quarter,
        year,
      },
    });

    const label = await adminLabel();
    await addHistory(request.id, null, "payment_pending", label, { secondCopy: true, paymentAmount: 30 });

    await recordAudit({
      userId: user.id,
      action: "CREATE",
      entity: "PhysicalCardRequest",
      entityId: request.id,
      metadata: { memberId, quarter, year, requestType: "SEGUNDA_VIA" },
    });

    // Aviso à secretaria pelo Mensageiro (best-effort, nunca lança).
    await notifyCardRequest({
      memberId,
      memberFullName: member.fullName,
      tipo: "2ª via",
    });

    revalidatePath("/carteirinha/fisica");
    return { ok: true, requestId: request.id };
  } catch {
    return { error: "Erro ao criar solicitação de 2ª via." };
  }
}

// ---------------------------------------------------------------------------
// Segunda via — Confirmar pagamento (payment_pending → issuance_pending)
// ---------------------------------------------------------------------------
export async function confirmPayment(id: string) {
  const user = await requireAdmin();
  const label = await adminLabel();

  const req = await prisma.physicalCardRequest.findUnique({ where: { id } });
  if (!req) return { error: "Solicitação não encontrada." };
  if (req.currentStage !== "payment_pending") {
    return { error: "Solicitação não está aguardando pagamento." };
  }

  try {
    await prisma.physicalCardRequest.update({
      where: { id },
      data: {
        currentStage: "issuance_pending",
        paymentPaidAt: new Date(),
      },
    });

    await addHistory(id, "payment_pending", "issuance_pending", label, {
      paymentConfirmed: true,
      paymentAmount: req.paymentAmount,
    });

    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "PhysicalCardRequest",
      entityId: id,
      metadata: { action: "confirm_payment", paymentAmount: req.paymentAmount },
    });

    revalidatePath("/carteirinha/fisica");
    revalidatePath(`/carteirinha/fisica/${id}`);
    return { ok: true };
  } catch {
    return { error: "Erro ao confirmar pagamento." };
  }
}

import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { generateReceiptNumber } from "@/lib/receipt";
import { notifyPaymentConfirmed, notifyReceiptRejected } from "@/lib/messenger";

export type ConfirmPaidResult =
  | {
      ok: true;
      alreadyPaid: boolean;
      receiptNumber: string;
      memberFullName: string;
      referenceMonth: number;
      referenceYear: number;
      amount: number;
    }
  | { ok: false; error: string };

// Núcleo de confirmação de pagamento (baixa), reusável por baixa manual (CRM),
// webhook Asaas e baixa via WhatsApp. Gera recibo, marca PAGO, audita e avisa o
// associado. Idempotente: se já está PAGO, retorna alreadyPaid sem reenviar.
export async function confirmPaymentPaid(
  paymentId: string,
  opts: { via: "MANUAL" | "ASAAS" | "WHATSAPP"; userId?: string; byLabel?: string; paidAt?: Date },
): Promise<ConfirmPaidResult> {
  try {
    const resolvedDate = opts.paidAt ?? new Date();
    const year = resolvedDate.getFullYear();

    const runOnce = () =>
      prisma.$transaction(async (tx) => {
        const existing = await tx.payment.findUnique({ where: { id: paymentId } });
        if (!existing) return { kind: "notfound" as const };
        if (existing.status === "PAGO") return { kind: "already" as const, payment: existing };

        const receiptNumber = existing.receiptNumber ?? (await generateReceiptNumber(tx, year));
        const payment = await tx.payment.update({
          where: { id: paymentId },
          data: {
            status: "PAGO",
            paidAt: existing.paidAt ?? resolvedDate,
            receiptNumber,
            confirmedVia: opts.via,
          },
          include: { member: { select: { id: true, fullName: true, whatsapp: true, phone: true } } },
        });
        return { kind: "updated" as const, payment };
      });

    // receiptNumber é @unique: se duas baixas concorrentes calcularem o mesmo
    // MAX+1, uma falha com P2002 — tenta de novo com o MAX já atualizado.
    let result: Awaited<ReturnType<typeof runOnce>>;
    let attempt = 0;
    for (;;) {
      try {
        result = await runOnce();
        break;
      } catch (e) {
        const isUnique = (e as { code?: string })?.code === "P2002";
        if (!isUnique || ++attempt >= 3) throw e;
      }
    }

    if (result.kind === "notfound") return { ok: false, error: "Pagamento não encontrado." };

    if (result.kind === "already") {
      const p = result.payment;
      return {
        ok: true,
        alreadyPaid: true,
        receiptNumber: p.receiptNumber ?? "",
        memberFullName: "",
        referenceMonth: p.referenceMonth,
        referenceYear: p.referenceYear,
        amount: p.amount,
      };
    }

    const p = result.payment;
    await recordAudit({
      userId: opts.userId,
      action: "UPDATE",
      entity: "Payment",
      entityId: paymentId,
      metadata: { status: "PAGO", receiptNumber: p.receiptNumber, via: opts.via, by: opts.byLabel },
    });
    await notifyPaymentConfirmed({
      memberId: p.member.id,
      memberFullName: p.member.fullName,
      memberWhatsapp: p.member.whatsapp,
      memberPhone: p.member.phone,
      amount: p.amount,
      referenceMonth: p.referenceMonth,
      referenceYear: p.referenceYear,
      receiptNumber: p.receiptNumber ?? "",
    });

    return {
      ok: true,
      alreadyPaid: false,
      receiptNumber: p.receiptNumber ?? "",
      memberFullName: p.member.fullName,
      referenceMonth: p.referenceMonth,
      referenceYear: p.referenceYear,
      amount: p.amount,
    };
  } catch {
    return { ok: false, error: "Erro ao confirmar o pagamento." };
  }
}

export type RejectReceiptResult =
  | { ok: true; memberFullName: string; referenceMonth: number; referenceYear: number }
  | { ok: false; error: string };

// Recusa o comprovante: volta o pagamento para PENDENTE/ATRASADO, limpa o
// comprovante e avisa o associado. Reusável por CRM e baixa via WhatsApp.
export async function rejectPaymentReceipt(
  paymentId: string,
  opts: { userId?: string; byLabel?: string },
): Promise<RejectReceiptResult> {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { member: { select: { id: true, fullName: true, whatsapp: true, phone: true } } },
    });
    if (!payment) return { ok: false, error: "Pagamento não encontrado." };
    if (payment.status === "PAGO") return { ok: false, error: "Pagamento já está pago." };

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: payment.dueDate < new Date() ? "ATRASADO" : "PENDENTE",
        receiptPath: null,
        receiptSubmittedAt: null,
        receiptWhatsappMsgId: null,
      },
    });
    await recordAudit({
      userId: opts.userId,
      action: "UPDATE",
      entity: "Payment",
      entityId: paymentId,
      metadata: { action: "receipt_rejected", by: opts.byLabel },
    });
    await notifyReceiptRejected({
      memberId: payment.member.id,
      memberFullName: payment.member.fullName,
      memberWhatsapp: payment.member.whatsapp,
      memberPhone: payment.member.phone,
      referenceMonth: payment.referenceMonth,
      referenceYear: payment.referenceYear,
    });
    return {
      ok: true,
      memberFullName: payment.member.fullName,
      referenceMonth: payment.referenceMonth,
      referenceYear: payment.referenceYear,
    };
  } catch {
    return { ok: false, error: "Erro ao recusar o comprovante." };
  }
}

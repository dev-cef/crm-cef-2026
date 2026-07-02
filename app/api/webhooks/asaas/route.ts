import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { notifyPaymentConfirmed } from "@/lib/messenger";
import { generateReceiptNumber } from "@/lib/receipt";

const PAID_EVENTS = ["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"];

export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token");
  if (!process.env.ASAAS_WEBHOOK_TOKEN || token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !PAID_EVENTS.includes(body.event)) {
    // Eventos que não confirmam pagamento (ex: PAYMENT_CREATED) são ignorados, mas
    // respondemos 200 pra Asaas não ficar reentregando o webhook.
    return NextResponse.json({ ignored: body?.event ?? null });
  }

  const paymentId: string | undefined = body.payment?.externalReference;
  if (!paymentId) {
    return NextResponse.json({ error: "Missing externalReference" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({ where: { id: paymentId } });
    // Payment não existe (cancelado localmente) ou já baixado — no-op idempotente.
    if (!existing || existing.status === "PAGO") return null;

    const receiptNumber = await generateReceiptNumber(tx, new Date().getFullYear());

    return tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "PAGO",
        paidAt: body.payment.paymentDate ? new Date(body.payment.paymentDate) : new Date(),
        receiptNumber,
        confirmedVia: "ASAAS",
        asaasChargeId: body.payment.id ?? existing.asaasChargeId,
      },
      include: {
        member: { select: { id: true, fullName: true, whatsapp: true, phone: true } },
      },
    });
  });

  if (updated) {
    await recordAudit({
      action: "UPDATE",
      entity: "Payment",
      entityId: paymentId,
      metadata: {
        status: "PAGO",
        receiptNumber: updated.receiptNumber,
        source: "asaas_webhook",
        event: body.event,
      },
    });

    // Aviso ao associado pelo Mensageiro — nunca deve derrubar o 200 (Asaas reenvia em retry).
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
    revalidatePath("/meu-espaco");
  }

  return NextResponse.json({ ok: true });
}

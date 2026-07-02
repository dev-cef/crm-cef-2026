import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

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

    const year = new Date().getFullYear();
    const count = await tx.payment.count({
      where: { receiptNumber: { startsWith: `${year}-` } },
    });
    const receiptNumber = `${year}-${String(count + 1).padStart(4, "0")}`;

    return tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "PAGO",
        paidAt: body.payment.paymentDate ? new Date(body.payment.paymentDate) : new Date(),
        receiptNumber,
        confirmedVia: "ASAAS",
        asaasChargeId: body.payment.id ?? existing.asaasChargeId,
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
    revalidatePath("/financeiro/pagamentos");
    revalidatePath("/meu-espaco");
  }

  return NextResponse.json({ ok: true });
}

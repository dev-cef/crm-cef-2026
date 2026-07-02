import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { getSystemConfig } from "@/app/(app)/financeiro/actions";
import { sendWhatsAppMessage, sendWhatsAppGroupMessage, evolutionConfigured } from "@/lib/whatsapp";
import { formatBRL, monthName } from "@/lib/format";

const RECEIPT_MIME_PREFIXES = ["data:image/jpeg", "data:image/png", "data:application/pdf"];

// Rota comum (não Server Action) — o data URI do comprovante é grande o
// suficiente pra estourar o limite de serialização de argumentos de Server
// Actions do React ("Maximum array nesting exceeded"). Um POST simples via
// fetch não passa por essa serialização.
export async function POST(request: Request) {
  const user = await requireUser();
  if (!user.memberId) {
    return NextResponse.json({ error: "Sem cadastro vinculado." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const paymentId = body?.paymentId;
  const fileDataUri = body?.fileDataUri;
  if (typeof paymentId !== "string" || typeof fileDataUri !== "string") {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  if (!RECEIPT_MIME_PREFIXES.some((p) => fileDataUri.startsWith(p))) {
    return NextResponse.json({ error: "Formato inválido. Envie uma imagem (JPG/PNG) ou PDF." }, { status: 400 });
  }
  const base64 = fileDataUri.split(",")[1] ?? "";
  if (base64.length > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "O arquivo deve ter no máximo 3MB." }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { member: { select: { fullName: true } } },
  });
  if (!payment || payment.memberId !== user.memberId) {
    return NextResponse.json({ error: "Cobrança não encontrada." }, { status: 404 });
  }
  if (payment.status === "PAGO") {
    return NextResponse.json({ error: "Esta cobrança já está paga." }, { status: 400 });
  }

  try {
    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        receiptPath: fileDataUri,
        receiptSubmittedAt: new Date(),
        status: "AGUARDANDO_CONFIRMACAO",
      },
    });

    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "Payment",
      entityId: paymentId,
      metadata: { action: "receipt_submitted" },
    });

    // Aviso ao financeiro é best-effort — não deve impedir o envio do comprovante.
    try {
      const cfg = await getSystemConfig();
      if (cfg.financeiroWhatsapp && evolutionConfigured()) {
        const message = [
          "📎 Novo comprovante de pagamento enviado",
          "",
          `Associado: ${payment.member.fullName}`,
          `Referência: ${monthName(payment.referenceMonth)}/${payment.referenceYear}`,
          `Valor: ${formatBRL(payment.amount)}`,
          "",
          "Confira em Financeiro > Cobranças no CRM.",
        ].join("\n");

        if (cfg.financeiroWhatsapp.includes("@g.us")) {
          await sendWhatsAppGroupMessage(cfg.financeiroWhatsapp, message);
        } else {
          await sendWhatsAppMessage(cfg.financeiroWhatsapp, message);
        }
      }
    } catch (err) {
      console.error("Falha ao notificar financeiro via WhatsApp:", err);
    }

    revalidatePath("/meu-espaco");
    revalidatePath("/financeiro/pagamentos");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro ao enviar comprovante. Tente novamente." }, { status: 500 });
  }
}

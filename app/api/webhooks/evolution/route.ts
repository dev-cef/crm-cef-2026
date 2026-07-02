import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getMessengerConfig } from "@/lib/messenger";
import { confirmPaymentPaid } from "@/lib/payments";
import { sendWhatsAppGroupMessage } from "@/lib/whatsapp";
import { formatBRL, monthName } from "@/lib/format";

// Comandos que disparam a baixa (a pessoa responde/cita a notificação do comprovante).
const BAIXA_RE = /^\s*(baixa|baixar|pago|paga|confirmar|confirmado|confirmo)\b/i;

// Extrai o(s) identificador(es) do remetente da mensagem de grupo e normaliza
// para dígitos, tolerando prefixo 55 e o 9º dígito. Suporta @s.whatsapp.net e @lid.
function senderAllowed(data: Record<string, unknown>, allowlist: string[]): boolean {
  if (allowlist.length === 0) return false;
  const key = (data.key ?? {}) as Record<string, unknown>;
  const raw = [key.participant, key.participantPn, key.senderPn, data.participant]
    .filter((v): v is string => typeof v === "string");

  const candidates = new Set<string>();
  for (const id of raw) {
    const local = id.split("@")[0];
    candidates.add(local);
    const digits = local.replace(/\D/g, "");
    if (digits) {
      candidates.add(digits);
      candidates.add(digits.replace(/^55/, "")); // sem DDI
    }
  }

  for (const entry of allowlist) {
    const allow = entry.replace(/\D/g, "");
    if (allow.length < 8) continue;
    for (const c of candidates) {
      if (c === entry) return true; // match cru (ex.: lid)
      if (c.length >= 8 && (c.endsWith(allow) || allow.endsWith(c))) return true;
    }
  }
  return false;
}

export async function POST(request: Request) {
  // 1) Autenticação do webhook (segredo na query). Sem isso, qualquer um forjaria baixas.
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!process.env.EVOLUTION_WEBHOOK_TOKEN || token !== process.env.EVOLUTION_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || body.event !== "messages.upsert") {
    return NextResponse.json({ ignored: body?.event ?? null });
  }

  const data = (body.data ?? {}) as Record<string, unknown>;
  const key = (data.key ?? {}) as Record<string, unknown>;

  // Ignora mensagens do próprio bot (evita loop).
  if (key.fromMe === true) return NextResponse.json({ ignored: "fromMe" });

  const cfg = await getMessengerConfig();
  if (!cfg.whatsappBaixaEnabled) return NextResponse.json({ ignored: "disabled" });

  // Só o grupo do Financeiro pode comandar baixa.
  const remoteJid = typeof key.remoteJid === "string" ? key.remoteJid : "";
  if (!cfg.financeGroupJid || remoteJid !== cfg.financeGroupJid) {
    return NextResponse.json({ ignored: "not-finance-group" });
  }

  // Texto da mensagem (conversation OU extendedTextMessage.text).
  const message = (data.message ?? {}) as Record<string, unknown>;
  const ext = (message.extendedTextMessage ?? {}) as Record<string, unknown>;
  const text =
    (typeof message.conversation === "string" ? message.conversation : "") ||
    (typeof ext.text === "string" ? ext.text : "");

  // Precisa ser resposta (reply) à notificação do comprovante → pega o ID citado.
  const ctx = (ext.contextInfo ?? {}) as Record<string, unknown>;
  const stanzaId = typeof ctx.stanzaId === "string" ? ctx.stanzaId : null;

  // DIAGNÓSTICO (temporário): dump do que chega pra ajustar parsing/allowlist.
  console.log(
    "[evolution] rx",
    JSON.stringify({
      remoteJid,
      text,
      stanzaId,
      participant: key.participant,
      participantPn: key.participantPn,
      senderPn: key.senderPn,
      messageKeys: Object.keys(message),
      ctxKeys: Object.keys(ctx),
    }),
  );

  if (!BAIXA_RE.test(text)) return NextResponse.json({ ignored: "not-command" });
  if (!stanzaId) {
    await sendWhatsAppGroupMessage(
      cfg.financeGroupJid,
      "⚠️ Para dar baixa, *responda* (reply) a mensagem do comprovante com \"baixa\".",
    ).catch(() => {});
    return NextResponse.json({ ignored: "no-quote" });
  }

  const payment = await prisma.payment.findFirst({
    where: { receiptWhatsappMsgId: stanzaId },
    include: { member: { select: { fullName: true } } },
  });
  if (!payment) {
    console.log("[evolution] payment-not-found para stanzaId:", stanzaId);
    await sendWhatsAppGroupMessage(
      cfg.financeGroupJid,
      "⚠️ Não encontrei o comprovante correspondente a essa mensagem.",
    ).catch(() => {});
    return NextResponse.json({ ignored: "payment-not-found" });
  }

  // Autorização do remetente (allowlist).
  let allowlist: string[] = [];
  try {
    const parsed = JSON.parse(cfg.whatsappBaixaAllowlist);
    if (Array.isArray(parsed)) allowlist = parsed.map(String);
  } catch {
    /* allowlist inválida → ninguém autorizado */
  }
  if (!senderAllowed(data, allowlist)) {
    console.warn("[evolution] baixa negada — remetente não autorizado:", JSON.stringify(key));
    await sendWhatsAppGroupMessage(
      cfg.financeGroupJid,
      `❌ ${typeof data.pushName === "string" ? data.pushName : "Você"}, você não está autorizado a dar baixa por aqui.`,
    ).catch(() => {});
    return NextResponse.json({ ignored: "not-authorized" });
  }

  // Confirma o pagamento (idempotente).
  const sender = String(key.participant ?? key.participantPn ?? "");
  const res = await confirmPaymentPaid(payment.id, { via: "WHATSAPP", byLabel: `whatsapp:${sender}` });

  if (!res.ok) {
    await sendWhatsAppGroupMessage(cfg.financeGroupJid, `⚠️ Erro ao dar baixa: ${res.error}`).catch(() => {});
    return NextResponse.json({ error: res.error }, { status: 200 });
  }

  const ref = `${monthName(payment.referenceMonth)}/${payment.referenceYear}`;
  const reply = res.alreadyPaid
    ? `ℹ️ ${payment.member.fullName} — ${ref} já estava com pagamento confirmado (recibo ${res.receiptNumber}).`
    : `✅ Baixa registrada — ${payment.member.fullName}, ${ref}, ${formatBRL(payment.amount)}. Recibo ${res.receiptNumber}. O associado foi avisado.`;
  await sendWhatsAppGroupMessage(cfg.financeGroupJid, reply).catch(() => {});

  revalidatePath("/financeiro/pagamentos");
  revalidatePath("/meu-espaco");
  return NextResponse.json({ ok: true, alreadyPaid: res.alreadyPaid });
}

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getMessengerConfig } from "@/lib/messenger";
import { confirmPaymentPaid, rejectPaymentReceipt } from "@/lib/payments";
import { waSafeReceipt } from "@/lib/messenger";
import { sendWhatsAppGroupMessage, resolveGroupParticipantPhone } from "@/lib/whatsapp";
import { formatBRL, monthName } from "@/lib/format";

// Comandos (o membro manda no grupo, opcionalmente com matrícula).
const BAIXA_RE = /^\s*(baixa|baixar|pago|paga|confirmar|confirmado|confirmo|aprovar|aprovado|aprovo)\b/i;
const REJEITAR_RE = /^\s*(rejeit|recus|nega|negar|reprov)/i;

// Busca recursiva por um stanzaId (id da msg citada), tolerando variações de estrutura.
function deepFindStanzaId(obj: unknown, depth = 0): string | null {
  if (!obj || typeof obj !== "object" || depth > 6) return null;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === "stanzaId" && typeof v === "string" && v) return v;
    if (v && typeof v === "object") {
      const found = deepFindStanzaId(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// Autorização: casa o remetente (telefone resolvido do lid + identificadores crus) com a allowlist.
function isAllowed(candidates: string[], allowlist: string[]): boolean {
  const norm = candidates.filter(Boolean);
  for (const entry of allowlist) {
    const allow = entry.replace(/\D/g, "");
    if (allow.length < 8) continue;
    for (const c of norm) {
      if (c === entry) return true;
      const cd = c.replace(/\D/g, "");
      if (cd.length >= 8 && (cd.endsWith(allow) || allow.endsWith(cd))) return true;
    }
  }
  return false;
}

export async function POST(request: Request) {
  // 1) Autenticação do webhook (segredo na query).
  const url = new URL(request.url);
  if (!process.env.EVOLUTION_WEBHOOK_TOKEN || url.searchParams.get("token") !== process.env.EVOLUTION_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || body.event !== "messages.upsert") {
    return NextResponse.json({ ignored: body?.event ?? null });
  }

  const data = (body.data ?? {}) as Record<string, unknown>;
  const key = (data.key ?? {}) as Record<string, unknown>;
  if (key.fromMe === true) return NextResponse.json({ ignored: "fromMe" });

  const cfg = await getMessengerConfig();
  if (!cfg.whatsappBaixaEnabled) return NextResponse.json({ ignored: "disabled" });

  const remoteJid = typeof key.remoteJid === "string" ? key.remoteJid : "";
  if (!cfg.financeGroupJid || remoteJid !== cfg.financeGroupJid) {
    return NextResponse.json({ ignored: "not-finance-group" });
  }

  const message = (data.message ?? {}) as Record<string, unknown>;
  const ext = (message.extendedTextMessage ?? {}) as Record<string, unknown>;
  const text =
    (typeof message.conversation === "string" ? message.conversation : "") ||
    (typeof ext.text === "string" ? ext.text : "");
  const action: "approve" | "reject" | null = BAIXA_RE.test(text)
    ? "approve"
    : REJEITAR_RE.test(text)
      ? "reject"
      : null;
  if (!action) return NextResponse.json({ ignored: "not-command" });

  const reply = (msg: string) => sendWhatsAppGroupMessage(cfg.financeGroupJid!, msg).catch(() => {});

  // 2) Autorização do remetente. Match primário: lid do remetente ∈ lids salvos
  // (resolvidos na config, confiável). Fallbacks: telefone (participantPn/senderPn
  // ou resolução em runtime) contra a allowlist de telefones.
  const parse = (s: string): string[] => {
    try {
      const p = JSON.parse(s);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  };
  const allowlist = parse(cfg.whatsappBaixaAllowlist);
  const allowLids = parse(cfg.whatsappBaixaLids);
  const participant = String(key.participant ?? "");
  const participantLid = participant.split("@")[0];
  let senderPhone = String(key.participantPn ?? key.senderPn ?? "").replace(/\D/g, "");

  let authorized = allowLids.includes(participantLid);
  if (!authorized) {
    if (!senderPhone) senderPhone = (await resolveGroupParticipantPhone(cfg.financeGroupJid, participant)) ?? "";
    authorized = isAllowed([senderPhone, participantLid], allowlist);
  }
  if (!authorized) {
    console.warn("[evolution] baixa negada — não autorizado:", JSON.stringify({ participant, senderPhone }));
    await reply(`❌ ${typeof data.pushName === "string" ? data.pushName : "Você"}, você não está autorizado a dar baixa por aqui.`);
    return NextResponse.json({ ignored: "not-authorized" });
  }

  // 3) Identificação do pagamento: ID citado (se vier) → senão, pendentes.
  const quotedId = deepFindStanzaId(data);
  let payment = quotedId
    ? await prisma.payment.findFirst({
        where: { receiptWhatsappMsgId: quotedId },
        include: { member: { select: { fullName: true } } },
      })
    : null;

  if (!payment) {
    const arg = text.replace(BAIXA_RE, "").replace(REJEITAR_RE, "").trim();
    const matricula = arg.match(/\d{2,6}/)?.[0];
    const pendentes = await prisma.payment.findMany({
      where: { status: "AGUARDANDO_CONFIRMACAO", ...(matricula ? { member: { registration: Number(matricula) } } : {}) },
      include: { member: { select: { fullName: true, registration: true } } },
      orderBy: { receiptSubmittedAt: "desc" },
    });
    const verbo = action === "reject" ? "recusar" : "baixar";
    if (pendentes.length === 0) {
      await reply(matricula ? `⚠️ Nenhum comprovante pendente para a matrícula ${matricula}.` : "⚠️ Nenhum comprovante pendente no momento.");
      return NextResponse.json({ ignored: "no-pending" });
    }
    if (pendentes.length > 1) {
      const lista = pendentes.map((p) => `• ${p.member.fullName} (mat. ${p.member.registration}) — ${monthName(p.referenceMonth)}/${p.referenceYear}`).join("\n");
      await reply(`Há ${pendentes.length} comprovantes pendentes. Para ${verbo}, responda com *${action === "reject" ? "rejeitar" : "baixa"} <matrícula>*:\n${lista}`);
      return NextResponse.json({ ignored: "ambiguous" });
    }
    payment = pendentes[0];
  }

  const ref = `${monthName(payment.referenceMonth)}/${payment.referenceYear}`;
  const byLabel = `whatsapp:${senderPhone || participant}`;

  // 4) Executa a ação (idempotente).
  if (action === "reject") {
    const rej = await rejectPaymentReceipt(payment.id, { byLabel });
    if (!rej.ok) {
      await reply(`⚠️ Erro ao recusar: ${rej.error}`);
      return NextResponse.json({ error: rej.error }, { status: 200 });
    }
    await reply(`🚫 Comprovante recusado — ${payment.member.fullName}, ${ref}. O associado foi avisado para reenviar.`);
    revalidatePath("/financeiro/pagamentos");
    revalidatePath("/meu-espaco");
    return NextResponse.json({ ok: true, action: "reject" });
  }

  const res = await confirmPaymentPaid(payment.id, { via: "WHATSAPP", byLabel });
  if (!res.ok) {
    await reply(`⚠️ Erro ao dar baixa: ${res.error}`);
    return NextResponse.json({ error: res.error }, { status: 200 });
  }
  await reply(
    res.alreadyPaid
      ? `ℹ️ ${payment.member.fullName} — ${ref} já estava confirmado (recibo ${waSafeReceipt(res.receiptNumber)}).`
      : `✅ Baixa registrada — ${payment.member.fullName}, ${ref}, ${formatBRL(payment.amount)}. Recibo ${waSafeReceipt(res.receiptNumber)}. O associado foi avisado.`,
  );

  revalidatePath("/financeiro/pagamentos");
  revalidatePath("/meu-espaco");
  return NextResponse.json({ ok: true, alreadyPaid: res.alreadyPaid });
}

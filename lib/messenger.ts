// Módulo central de notificações (WhatsApp/e-mail). Toda tentativa de envio
// passa por aqui e é registrada em MessageLog — sucesso OU falha — pra dar
// visibilidade na tela do Mensageiro.

import { prisma } from "@/lib/prisma";
import {
  sendWhatsAppMessage,
  sendWhatsAppGroupMessage,
  sendWhatsAppMedia,
  sendWhatsAppGroupMedia,
} from "@/lib/whatsapp";
import { formatBRL, monthName } from "@/lib/format";

export type MessengerType =
  | "ANIVERSARIO"
  | "COMPROVANTE_RECEBIDO"
  | "COMPROVANTE_RECUSADO"
  | "PAGAMENTO_CONFIRMADO"
  | "NOVO_ASSOCIADO"
  | "CARTEIRINHA";
export type MessengerChannel = "WHATSAPP" | "EMAIL";

// Config singleton — mesmo padrão de getSystemConfig/getBirthdayConfig.
export async function getMessengerConfig() {
  let cfg = await prisma.messengerConfig.findFirst();
  if (!cfg) cfg = await prisma.messengerConfig.create({ data: {} });
  return cfg;
}

// O WhatsApp auto-linka "NNNN-NNNN" (acha que é telefone). Trocar o hífen normal
// por um hífen não-quebrável (U+2011) mantém o visual e evita o link.
export function waSafeReceipt(receipt: string): string {
  return receipt.replace(/-/g, "‑");
}

// Substitui {chave} pelos valores. Usado pelos tipos novos; o aniversário
// mantém buildBirthdayMessage (lib/birthday.ts), que tem lógica de primeiro nome.
export function renderTemplate(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, value);
  }
  return out;
}

// Único writer de MessageLog. Nunca lança (mesmo padrão defensivo de recordAudit).
export async function logMessengerAttempt(params: {
  type: MessengerType;
  channel: MessengerChannel;
  memberId?: string | null;
  recipient?: string | null;
  status: "ENVIADO" | "FALHA";
  errorMessage?: string | null;
}): Promise<void> {
  try {
    await prisma.messageLog.create({
      data: {
        type: params.type,
        channel: params.channel,
        memberId: params.memberId ?? null,
        recipient: params.recipient ?? null,
        status: params.status,
        errorMessage: params.errorMessage ?? null,
      },
    });
  } catch (err) {
    console.error("Falha ao registrar MessageLog:", err);
  }
}

// Choke point de WhatsApp: envia e SEMPRE registra o resultado antes de retornar.
export async function sendMessengerNotification(params: {
  type: MessengerType;
  memberId?: string | null;
  recipient: string;
  message: string;
  mediaDataUri?: string | null; // se presente, envia como mídia com o texto de legenda
}): Promise<{ ok: boolean; error?: string; messageId?: string | null }> {
  try {
    const isGroup = params.recipient.includes("@g.us");
    let messageId: string | null;
    if (params.mediaDataUri) {
      messageId = isGroup
        ? await sendWhatsAppGroupMedia(params.recipient, params.mediaDataUri, params.message)
        : await sendWhatsAppMedia(params.recipient, params.mediaDataUri, params.message);
    } else {
      messageId = isGroup
        ? await sendWhatsAppGroupMessage(params.recipient, params.message)
        : await sendWhatsAppMessage(params.recipient, params.message);
    }
    await logMessengerAttempt({
      type: params.type,
      channel: "WHATSAPP",
      memberId: params.memberId,
      recipient: params.recipient,
      status: "ENVIADO",
    });
    return { ok: true, messageId };
  } catch (e) {
    const error = String((e as Error).message ?? e);
    await logMessengerAttempt({
      type: params.type,
      channel: "WHATSAPP",
      memberId: params.memberId,
      recipient: params.recipient,
      status: "FALHA",
      errorMessage: error,
    });
    return { ok: false, error };
  }
}

// Aviso ao financeiro quando um associado envia comprovante. Fire-and-forget,
// nunca lança. Recipient (financeiroWhatsapp) vem por parâmetro pra evitar
// import circular com financeiro/actions.ts.
export async function notifyReceiptReceived(params: {
  paymentId: string;
  memberId: string;
  memberFullName: string;
  amount: number;
  referenceMonth: number;
  referenceYear: number;
  financeiroWhatsapp: string | null;
  receiptDataUri?: string | null; // imagem/PDF do comprovante enviado pelo associado
}): Promise<void> {
  try {
    const cfg = await getMessengerConfig();
    if (!cfg.receiptEnabled) return;

    // Roteamento: grupo do Financeiro quando configurado; senão o número do
    // financeiro (SystemConfig) e, por fim, o telefone padrão do clube.
    const recipient = cfg.financeGroupJid ?? params.financeiroWhatsapp ?? cfg.defaultPhone;
    if (!recipient) return;

    const isGroup = recipient.includes("@g.us");
    let message = renderTemplate(cfg.receiptTemplate, {
      associado: params.memberFullName,
      referencia: `${monthName(params.referenceMonth)}/${params.referenceYear}`,
      valor: formatBRL(params.amount),
    });
    // Dica de comandos quando a baixa por WhatsApp está ativa no grupo.
    if (isGroup && cfg.whatsappBaixaEnabled) {
      message += "\n\nResponda com *baixa* para aprovar ou *rejeitar* para recusar.";
    }

    // Envia a imagem/PDF do comprovante como mídia (legenda = texto); se não houver
    // comprovante ou falhar como mídia, cai no texto puro.
    const media = params.receiptDataUri?.startsWith("data:") ? params.receiptDataUri : null;
    let res = await sendMessengerNotification({
      type: "COMPROVANTE_RECEBIDO",
      memberId: params.memberId,
      recipient,
      message,
      mediaDataUri: media,
    });
    if (!res.ok && media) {
      res = await sendMessengerNotification({
        type: "COMPROVANTE_RECEBIDO",
        memberId: params.memberId,
        recipient,
        message,
      });
    }

    // Guarda o ID da msg no grupo → permite baixa respondendo (reply) essa msg.
    if (res.ok && res.messageId && isGroup) {
      await prisma.payment
        .update({ where: { id: params.paymentId }, data: { receiptWhatsappMsgId: res.messageId } })
        .catch(() => {});
    }
  } catch (err) {
    console.error("Falha ao notificar comprovante recebido:", err);
  }
}

// Aviso ao associado quando o comprovante é recusado (reenviar). Nunca lança.
export async function notifyReceiptRejected(params: {
  memberId: string;
  memberFullName: string;
  memberWhatsapp: string | null;
  memberPhone: string;
  referenceMonth: number;
  referenceYear: number;
}): Promise<void> {
  try {
    const recipient = params.memberWhatsapp ?? params.memberPhone;
    if (!recipient) return;
    const firstName = params.memberFullName.split(" ")[0] ?? params.memberFullName;
    const message =
      `Olá ${firstName}! Seu comprovante referente a ${monthName(params.referenceMonth)}/${params.referenceYear} ` +
      `não foi aprovado. Por favor, envie um comprovante válido novamente pelo sistema. — CEF`;
    await sendMessengerNotification({
      type: "COMPROVANTE_RECUSADO",
      memberId: params.memberId,
      recipient,
      message,
    });
  } catch (err) {
    console.error("Falha ao notificar comprovante recusado:", err);
  }
}

// Aviso ao associado quando um pagamento é confirmado (baixa manual ou Asaas).
// Fire-and-forget, nunca lança.
export async function notifyPaymentConfirmed(params: {
  memberId: string;
  memberFullName: string;
  memberWhatsapp: string | null;
  memberPhone: string;
  amount: number;
  referenceMonth: number;
  referenceYear: number;
  receiptNumber: string;
}): Promise<void> {
  try {
    const cfg = await getMessengerConfig();
    if (!cfg.paymentEnabled) return;

    const recipient = params.memberWhatsapp ?? params.memberPhone;
    if (!recipient) return;

    const firstName = params.memberFullName.split(" ")[0] ?? params.memberFullName;
    const message = renderTemplate(cfg.paymentTemplate, {
      nome: firstName,
      referencia: `${monthName(params.referenceMonth)}/${params.referenceYear}`,
      valor: formatBRL(params.amount),
      recibo: waSafeReceipt(params.receiptNumber),
    });

    await sendMessengerNotification({
      type: "PAGAMENTO_CONFIRMADO",
      memberId: params.memberId,
      recipient,
      message,
    });
  } catch (err) {
    console.error("Falha ao notificar pagamento confirmado:", err);
  }
}

// Aviso à secretaria quando alguém se auto-cadastra (antes da aprovação).
// Roteia pro grupo da Secretaria; fallback pro telefone padrão. Nunca lança.
export async function notifyNewMember(params: {
  memberId: string;
  memberFullName: string;
  registration: number;
  phone: string;
  email: string;
}): Promise<void> {
  try {
    const cfg = await getMessengerConfig();
    if (!cfg.newMemberEnabled) return;

    const recipient = cfg.secretariaGroupJid ?? cfg.defaultPhone;
    if (!recipient) return;

    const message = renderTemplate(cfg.newMemberTemplate, {
      associado: params.memberFullName,
      matricula: String(params.registration),
      telefone: params.phone,
      email: params.email,
    });

    await sendMessengerNotification({
      type: "NOVO_ASSOCIADO",
      memberId: params.memberId,
      recipient,
      message,
    });
  } catch (err) {
    console.error("Falha ao notificar novo associado:", err);
  }
}

// Aviso à secretaria quando uma solicitação de carteirinha física é aberta.
// Roteia pro grupo da Secretaria; fallback pro telefone padrão. Nunca lança.
export async function notifyCardRequest(params: {
  memberId: string;
  memberFullName: string;
  tipo: string; // "1ª via" | "2ª via"
}): Promise<void> {
  try {
    const cfg = await getMessengerConfig();
    if (!cfg.cardRequestEnabled) return;

    const recipient = cfg.secretariaGroupJid ?? cfg.defaultPhone;
    if (!recipient) return;

    const message = renderTemplate(cfg.cardRequestTemplate, {
      associado: params.memberFullName,
      tipo: params.tipo,
    });

    await sendMessengerNotification({
      type: "CARTEIRINHA",
      memberId: params.memberId,
      recipient,
      message,
    });
  } catch (err) {
    console.error("Falha ao notificar solicitação de carteirinha:", err);
  }
}

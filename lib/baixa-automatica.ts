// Pipeline de baixa automática: comprovante chega pelo WhatsApp do clube →
// identifica o sócio pelo telefone → extrai os dados via IA → valida contra as
// pendências → modo sombra (encaminha pro grupo com os dados, humano dá "baixa")
// ou automático (baixa direto) → casos ambíguos caem na fila de revisão manual.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { extrairComprovante, type ComprovanteExtraido } from "@/lib/comprovante-ai";
import { confirmPaymentPaid } from "@/lib/payments";
import { getMessengerConfig, sendMessengerNotification } from "@/lib/messenger";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { formatBRL, monthName, toNum } from "@/lib/format";

// Limiares de validação — ajustar após observar casos reais.
export const CONFIANCA_MINIMA = 0.75;

const MOTIVO_LABEL: Record<string, string> = {
  socio_nao_identificado: "sócio não identificado pelo telefone",
  extracao_indisponivel: "extração por IA indisponível",
  nao_e_comprovante: "imagem não parece ser um comprovante",
  baixa_confianca: "comprovante ilegível / baixa confiança",
  sem_pendencia: "sócio sem mensalidade em aberto",
  valor_divergente: "valor não bate com nenhuma pendência",
  multiplas_pendencias: "mais de uma pendência com esse valor",
  comprovante_duplicado: "mesma imagem já foi usada",
  transacao_duplicada: "ID da transação já foi usado",
};

type PendingPayment = {
  id: string;
  amount: number;
  referenceMonth: number;
  referenceYear: number;
};

// Motor de validação — função pura, testável isoladamente.
export function validarComprovante(
  extracao: ComprovanteExtraido,
  pendencias: PendingPayment[],
): { decisao: "baixar"; payment: PendingPayment } | { decisao: "revisar"; motivo: string } {
  if (!extracao.ehComprovante) return { decisao: "revisar", motivo: "nao_e_comprovante" };
  if (extracao.confianca < CONFIANCA_MINIMA) return { decisao: "revisar", motivo: "baixa_confianca" };
  if (pendencias.length === 0) return { decisao: "revisar", motivo: "sem_pendencia" };
  if (extracao.valor == null) return { decisao: "revisar", motivo: "baixa_confianca" };

  const compativeis = pendencias.filter((p) => Math.abs(p.amount - extracao.valor!) < 0.005);
  if (compativeis.length === 0) return { decisao: "revisar", motivo: "valor_divergente" };
  if (compativeis.length > 1) return { decisao: "revisar", motivo: "multiplas_pendencias" };
  return { decisao: "baixar", payment: compativeis[0] };
}

// Identifica o sócio pelo telefone (sufixo, tolerante a DDI/9º dígito).
async function identificarSocio(senderPhone: string) {
  const digits = senderPhone.replace(/\D/g, "").replace(/^55/, "");
  if (digits.length < 8) return null;
  const members = await prisma.member.findMany({
    where: { deletedAt: null },
    select: { id: true, fullName: true, phone: true, whatsapp: true },
  });
  const matches = members.filter((m) => {
    for (const field of [m.whatsapp, m.phone]) {
      const d = (field ?? "").replace(/\D/g, "").replace(/^55/, "");
      if (d.length >= 8 && (d.endsWith(digits) || digits.endsWith(d))) return true;
    }
    return false;
  });
  return matches.length === 1 ? matches[0] : null; // 0 ou >1 → não identificado
}

export async function processarComprovanteWhatsapp(params: {
  whatsappMessageId: string;
  senderJid: string;
  senderPhone: string;
  pushName: string | null;
  messageData: unknown; // objeto `data` do webhook, usado pra baixar a mídia
  imageDataUri: string;
}): Promise<{ ok: boolean; resultado: string }> {
  const cfg = await getMessengerConfig();
  const sha = crypto
    .createHash("sha256")
    .update(params.imageDataUri.slice(params.imageDataUri.indexOf(",") + 1))
    .digest("base64");

  // Idempotência: reentrega do mesmo evento não cria outro registro.
  let comprovante;
  try {
    comprovante = await prisma.whatsappComprovante.create({
      data: {
        whatsappMessageId: params.whatsappMessageId,
        senderJid: params.senderJid,
        senderPhone: params.senderPhone,
        pushName: params.pushName,
        imageDataUri: params.imageDataUri,
        imageSha256: sha,
      },
    });
  } catch {
    return { ok: true, resultado: "duplicado_ignorado" };
  }

  const setStatus = (data: Record<string, unknown>) =>
    prisma.whatsappComprovante.update({ where: { id: comprovante.id }, data });

  const avisarGrupo = async (texto: string, memberId?: string | null, media?: string) => {
    const recipient = cfg.financeGroupJid ?? cfg.defaultPhone;
    if (!recipient) return null;
    return sendMessengerNotification({
      type: "COMPROVANTE_RECEBIDO",
      memberId: memberId ?? null,
      recipient,
      message: texto,
      mediaDataUri: media ?? null,
    });
  };

  const responderRemetente = (texto: string) =>
    sendWhatsAppMessage(params.senderPhone, texto).catch(() => null);

  // 1) Sócio pelo telefone — sem sócio não há como validar (economiza IA).
  const socio = await identificarSocio(params.senderPhone);
  if (!socio) {
    await setStatus({ status: "AGUARDANDO_REVISAO", motivoRevisao: "socio_nao_identificado" });
    await avisarGrupo(
      `📥 Comprovante recebido no WhatsApp do clube de ${params.pushName ?? params.senderPhone} — ` +
        `não consegui identificar o sócio pelo telefone. Confira em Financeiro > Comprovantes no CRM.`,
      null,
      params.imageDataUri,
    );
    return { ok: true, resultado: "revisao:socio_nao_identificado" };
  }
  await setStatus({ memberId: socio.id });

  // 2) Dedupe da imagem (mesmo print reenviado) antes de gastar IA.
  const jaUsado = await prisma.whatsappComprovante.findFirst({
    where: {
      imageSha256: sha,
      id: { not: comprovante.id },
      status: { in: ["ENCAMINHADO_GRUPO", "VALIDADO_AUTO", "VALIDADO_MANUAL"] },
    },
  });
  if (jaUsado) {
    await setStatus({ status: "AGUARDANDO_REVISAO", motivoRevisao: "comprovante_duplicado" });
    await responderRemetente(
      `Olá ${socio.fullName.split(" ")[0]}! Este comprovante já foi recebido antes. ` +
        `Se acredita que é um pagamento novo, envie o comprovante correto ou fale com o financeiro. — CEF`,
    );
    return { ok: true, resultado: "revisao:comprovante_duplicado" };
  }

  // 3) Extração via IA (provedor/modelo escolhidos no painel).
  const resultado = await extrairComprovante(params.imageDataUri, cfg.aiProvider, cfg.aiModel);
  const extracao = resultado?.extracao ?? null;
  if (resultado) {
    await setStatus({
      extracaoRaw: resultado.raw,
      valor: extracao!.valor,
      dataHora: extracao!.dataHora,
      idTransacao: extracao!.idTransacao,
      nomePagador: extracao!.nomePagador,
      instituicao: extracao!.instituicao,
      confianca: extracao!.confianca,
    });
  }

  const paraRevisao = async (motivo: string) => {
    await setStatus({ status: "AGUARDANDO_REVISAO", motivoRevisao: motivo });
    await avisarGrupo(
      `📥 Comprovante de ${socio.fullName} aguardando revisão manual ` +
        `(${MOTIVO_LABEL[motivo] ?? motivo}). Confira em Financeiro > Comprovantes no CRM.`,
      socio.id,
      params.imageDataUri,
    );
    await responderRemetente(
      `Olá ${socio.fullName.split(" ")[0]}! Recebemos seu comprovante — ele está em análise ` +
        `pelo financeiro e em breve confirmamos o pagamento. — CEF`,
    );
    return { ok: true, resultado: `revisao:${motivo}` };
  };

  if (!extracao) return paraRevisao("extracao_indisponivel");

  // 4) Dedupe por ID de transação PIX.
  if (extracao.idTransacao) {
    const txDup = await prisma.whatsappComprovante.findFirst({
      where: {
        idTransacao: extracao.idTransacao,
        id: { not: comprovante.id },
        status: { in: ["ENCAMINHADO_GRUPO", "VALIDADO_AUTO", "VALIDADO_MANUAL"] },
      },
    });
    if (txDup) return paraRevisao("transacao_duplicada");
  }

  // 5) Valida contra as pendências do sócio.
  const pendenciasRaw = await prisma.payment.findMany({
    where: { memberId: socio.id, status: { in: ["PENDENTE", "ATRASADO"] } },
    select: { id: true, amount: true, referenceMonth: true, referenceYear: true },
    orderBy: [{ referenceYear: "asc" }, { referenceMonth: "asc" }],
  });
  // amount vem como Prisma.Decimal — normaliza para number (PendingPayment.amount).
  const pendencias = pendenciasRaw.map((p) => ({ ...p, amount: toNum(p.amount) }));
  const decisao = validarComprovante(extracao, pendencias);
  if (decisao.decisao === "revisar") return paraRevisao(decisao.motivo);

  const pay = decisao.payment;
  const ref = `${monthName(pay.referenceMonth)}/${pay.referenceYear}`;
  const resumo =
    `Associado: ${socio.fullName}\nReferência: ${ref}\nValor: ${formatBRL(pay.amount)}\n` +
    `Pagador: ${extracao.nomePagador ?? "—"} · ${extracao.instituicao ?? "—"}\n` +
    `Confiança da leitura: ${(extracao.confianca * 100).toFixed(0)}%`;

  // 6a) Modo automático: baixa direto.
  if (cfg.autoBaixaEnabled) {
    const res = await confirmPaymentPaid(pay.id, {
      via: "WHATSAPP",
      byLabel: `auto-ia:${params.senderPhone}`,
    });
    if (!res.ok) return paraRevisao("extracao_indisponivel");
    await setStatus({ status: "VALIDADO_AUTO", paymentId: pay.id });
    await avisarGrupo(`✅ Baixa automática realizada\n\n${resumo}\nRecibo ${res.receiptNumber}.`, socio.id, params.imageDataUri);
    return { ok: true, resultado: "baixa_automatica" };
  }

  // 6b) Modo sombra: anexa ao pagamento e encaminha pro grupo — o fluxo humano
  // de "baixa"/"rejeitar" já existente confirma. IA valida, humano decide.
  await prisma.payment.update({
    where: { id: pay.id },
    data: {
      receiptPath: params.imageDataUri,
      receiptSubmittedAt: new Date(),
      status: "AGUARDANDO_CONFIRMACAO",
    },
  });
  const envio = await avisarGrupo(
    `📎 Comprovante recebido pelo WhatsApp (validado pela IA)\n\n${resumo}\n\n` +
      `Responda com *baixa* para aprovar ou *rejeitar* para recusar.`,
    socio.id,
    params.imageDataUri,
  );
  if (envio?.ok && envio.messageId) {
    await prisma.payment.update({ where: { id: pay.id }, data: { receiptWhatsappMsgId: envio.messageId } });
  }
  await setStatus({ status: "ENCAMINHADO_GRUPO", paymentId: pay.id });
  await responderRemetente(
    `Olá ${socio.fullName.split(" ")[0]}! Recebemos seu comprovante de ${formatBRL(pay.amount)} ` +
      `referente a ${ref}. Ele está em análise pelo financeiro — você receberá o recibo assim que confirmado. — CEF`,
  );
  return { ok: true, resultado: "encaminhado_grupo" };
}

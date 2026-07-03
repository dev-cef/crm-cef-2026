"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { confirmPaymentPaid } from "@/lib/payments";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

type Result = { ok: boolean; error?: string };

async function requireFinanceiroEdit() {
  const session = await auth();
  const sessionUser = toSessionUser(session?.user ?? {});
  if (!(await can(sessionUser, "financeiro", "edit"))) return null;
  return session;
}

// Aprova um comprovante da fila: vincula ao pagamento escolhido, anexa a imagem
// e dá baixa pelo mesmo núcleo usado no CRM/WhatsApp (recibo + aviso ao associado).
export async function aprovarComprovante(comprovanteId: string, paymentId: string): Promise<Result> {
  const session = await requireFinanceiroEdit();
  if (!session) return { ok: false, error: "Sem permissão." };

  const comprovante = await prisma.whatsappComprovante.findUnique({ where: { id: comprovanteId } });
  if (!comprovante) return { ok: false, error: "Comprovante não encontrado." };
  if (comprovante.status !== "AGUARDANDO_REVISAO") return { ok: false, error: "Comprovante já foi resolvido." };

  await prisma.payment.update({
    where: { id: paymentId },
    data: { receiptPath: comprovante.imageDataUri, receiptSubmittedAt: comprovante.createdAt },
  });
  const res = await confirmPaymentPaid(paymentId, {
    via: "WHATSAPP",
    userId: session.user?.id,
    byLabel: `revisao-manual:${session.user?.email ?? session.user?.id}`,
  });
  if (!res.ok) return { ok: false, error: res.error };

  await prisma.whatsappComprovante.update({
    where: { id: comprovanteId },
    data: {
      status: "VALIDADO_MANUAL",
      paymentId,
      revisadoPor: session.user?.email ?? session.user?.id ?? null,
    },
  });
  revalidatePath("/financeiro/comprovantes");
  revalidatePath("/financeiro/pagamentos");
  return { ok: true };
}

// Rejeita um comprovante da fila e avisa o remetente pra reenviar/procurar o financeiro.
export async function rejeitarComprovante(comprovanteId: string): Promise<Result> {
  const session = await requireFinanceiroEdit();
  if (!session) return { ok: false, error: "Sem permissão." };

  const comprovante = await prisma.whatsappComprovante.findUnique({
    where: { id: comprovanteId },
    include: { member: { select: { fullName: true } } },
  });
  if (!comprovante) return { ok: false, error: "Comprovante não encontrado." };
  if (comprovante.status !== "AGUARDANDO_REVISAO") return { ok: false, error: "Comprovante já foi resolvido." };

  await prisma.whatsappComprovante.update({
    where: { id: comprovanteId },
    data: { status: "REJEITADO", revisadoPor: session.user?.email ?? session.user?.id ?? null },
  });

  const firstName = comprovante.member?.fullName.split(" ")[0];
  await sendWhatsAppMessage(
    comprovante.senderPhone,
    `Olá${firstName ? ` ${firstName}` : ""}! O comprovante enviado ao clube não pôde ser aprovado. ` +
      `Por favor, confira o pagamento e envie um comprovante válido, ou fale com o financeiro. — CEF`,
  ).catch(() => null);

  revalidatePath("/financeiro/comprovantes");
  return { ok: true };
}

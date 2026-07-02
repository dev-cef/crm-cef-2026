"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { getSystemConfig } from "@/app/(app)/financeiro/actions";
import { sendWhatsAppMessage, sendWhatsAppGroupMessage, evolutionConfigured } from "@/lib/whatsapp";
import { formatBRL, monthName } from "@/lib/format";

const profileSchema = z.object({
  email: z.string().email("E-mail inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  cep: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

export async function updateMemberProfile(formData: unknown) {
  const user = await requireUser();

  if (!user.memberId) return { error: "Sem cadastro vinculado." };

  const parsed = profileSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const data = parsed.data;

  try {
    await prisma.$transaction([
      prisma.member.update({
        where: { id: user.memberId },
        data: {
          email: data.email,
          phone: data.phone,
          cep: data.cep ?? "",
          street: data.street ?? "",
          number: data.number ?? "",
          complement: data.complement || null,
          neighborhood: data.neighborhood ?? "",
          city: data.city ?? "",
          state: data.state ?? "",
          emergencyName: data.emergencyName ?? "",
          emergencyPhone: data.emergencyPhone ?? "",
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { email: data.email },
      }),
    ]);

    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "Member",
      entityId: user.memberId,
      metadata: { fields: Object.keys(data) },
    });

    revalidatePath("/meu-espaco");
    return { ok: true };
  } catch {
    return { error: "Erro ao atualizar dados. Tente novamente." };
  }
}

export async function updateMemberPhoto(photoUrl: string | null) {
  const user = await requireUser();

  if (!user.memberId) return { error: "Sem cadastro vinculado." };

  if (photoUrl !== null) {
    if (!photoUrl.startsWith("data:image/jpeg") && !photoUrl.startsWith("data:image/png")) {
      return { error: "Formato inválido. Use JPG ou PNG." };
    }
    const base64 = photoUrl.split(",")[1] ?? "";
    if (base64.length > 2.5 * 1024 * 1024) {
      return { error: "A foto deve ter no máximo 2MB." };
    }
  }

  try {
    await prisma.member.update({
      where: { id: user.memberId },
      data: { photoUrl },
    });

    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "Member",
      entityId: user.memberId,
      metadata: { fields: ["photoUrl"] },
    });

    revalidatePath("/meu-espaco");
    return { ok: true };
  } catch {
    return { error: "Erro ao atualizar foto. Tente novamente." };
  }
}

const RECEIPT_MIME_PREFIXES = ["data:image/jpeg", "data:image/png", "data:application/pdf"];

export async function sendPaymentReceipt(paymentId: string, fileDataUri: string) {
  const user = await requireUser();
  if (!user.memberId) return { error: "Sem cadastro vinculado." };

  if (!RECEIPT_MIME_PREFIXES.some((p) => fileDataUri.startsWith(p))) {
    return { error: "Formato inválido. Envie uma imagem (JPG/PNG) ou PDF." };
  }
  const base64 = fileDataUri.split(",")[1] ?? "";
  if (base64.length > 4 * 1024 * 1024) {
    return { error: "O arquivo deve ter no máximo 3MB." };
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { member: { select: { fullName: true } } },
  });
  if (!payment || payment.memberId !== user.memberId) {
    return { error: "Cobrança não encontrada." };
  }
  if (payment.status === "PAGO") {
    return { error: "Esta cobrança já está paga." };
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
    return { ok: true };
  } catch {
    return { error: "Erro ao enviar comprovante. Tente novamente." };
  }
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Senha atual obrigatória"),
    newPassword: z
      .string()
      .min(8, "Nova senha deve ter no mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export async function changePassword(formData: unknown) {
  const user = await requireUser();

  const parsed = passwordSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { currentPassword, newPassword } = parsed.data;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return { error: "Usuário não encontrado." };

  const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
  if (!valid) return { error: "Senha atual incorreta." };

  const hash = await bcrypt.hash(newPassword, 12);

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash },
    });

    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      metadata: { action: "password_change" },
    });

    return { ok: true };
  } catch {
    return { error: "Erro ao trocar senha. Tente novamente." };
  }
}

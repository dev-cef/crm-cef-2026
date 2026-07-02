"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import {
  asaasConfigured,
  asaasFindCustomerByCpf,
  asaasCreateCustomer,
  asaasCreatePixCharge,
  asaasGetPixQrCode,
} from "@/lib/asaas";
import { monthName } from "@/lib/format";

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

// O envio do comprovante em si virou uma rota comum (app/api/meu-espaco/receipt) —
// o data URI é grande demais pra ir como argumento de Server Action (esbarra no
// limite de serialização de arrays do React: "Maximum array nesting exceeded").

export async function getOrCreateAsaasCharge(paymentId: string): Promise<
  | { ok: true; pixPayload: string; qrDataUrl: string; expiresAt: string }
  | { ok: false; error: string }
> {
  const user = await requireUser();
  if (!user.memberId) return { ok: false, error: "Sem cadastro vinculado." };
  if (!asaasConfigured()) {
    return {
      ok: false,
      error: "Cobrança automática não configurada. Use a transferência bancária ou envie o comprovante.",
    };
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { member: true },
  });
  if (!payment || payment.memberId !== user.memberId) {
    return { ok: false, error: "Cobrança não encontrada." };
  }
  if (payment.status === "PAGO") {
    return { ok: false, error: "Esta cobrança já está paga." };
  }

  // Cobrança já gerada e QR ainda válido — reaproveita sem chamar a Asaas de novo.
  if (
    payment.asaasPixPayload &&
    payment.asaasPixQrCode &&
    payment.asaasPixExpiresAt &&
    payment.asaasPixExpiresAt.getTime() > Date.now()
  ) {
    return {
      ok: true,
      pixPayload: payment.asaasPixPayload,
      qrDataUrl: payment.asaasPixQrCode,
      expiresAt: payment.asaasPixExpiresAt.toISOString(),
    };
  }

  try {
    let customerId = payment.member.asaasCustomerId;
    if (!customerId) {
      const cpfDigits = payment.member.cpf.replace(/\D/g, "");
      const existing = await asaasFindCustomerByCpf(cpfDigits);
      customerId =
        existing?.id ??
        (
          await asaasCreateCustomer({
            name: payment.member.fullName,
            cpfCnpj: cpfDigits,
            email: payment.member.email,
            phone: payment.member.phone,
          })
        ).id;
      await prisma.member.update({
        where: { id: payment.member.id },
        data: { asaasCustomerId: customerId },
      });
    }

    let chargeId = payment.asaasChargeId;
    if (!chargeId) {
      // Cobrança vencida: envia vencimento de hoje pra Asaas sem alterar o dueDate interno (usado pro badge ATRASADO).
      const asaasDueDate = payment.dueDate < new Date() ? new Date() : payment.dueDate;
      const charge = await asaasCreatePixCharge({
        customer: customerId,
        value: payment.amount,
        dueDate: asaasDueDate.toISOString().slice(0, 10),
        externalReference: payment.id,
        description: `CEF ${monthName(payment.referenceMonth)}/${payment.referenceYear}`,
      });
      chargeId = charge.id;
    }

    const qr = await asaasGetPixQrCode(chargeId);
    const qrDataUrl = qr.encodedImage.startsWith("data:")
      ? qr.encodedImage
      : `data:image/png;base64,${qr.encodedImage}`;
    const expiresAt = new Date(qr.expirationDate);

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        asaasChargeId: chargeId,
        asaasPixPayload: qr.payload,
        asaasPixQrCode: qrDataUrl,
        asaasPixExpiresAt: expiresAt,
      },
    });

    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "Payment",
      entityId: paymentId,
      metadata: { action: "asaas_charge_generated", asaasChargeId: chargeId },
    });

    return { ok: true, pixPayload: qr.payload, qrDataUrl, expiresAt: expiresAt.toISOString() };
  } catch (err) {
    console.error("Erro ao gerar cobrança Asaas:", err);
    return {
      ok: false,
      error: "Não foi possível gerar o PIX automático agora. Use a transferência bancária ou envie o comprovante manualmente.",
    };
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

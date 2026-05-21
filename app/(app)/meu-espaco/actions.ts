"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";

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

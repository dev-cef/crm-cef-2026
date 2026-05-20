"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { roleSchema } from "@/lib/rbac";
import { passwordSchema } from "@/lib/validations/auth";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().trim().min(3, "Nome muito curto"),
  email: z.email("E-mail inválido"),
  password: passwordSchema,
  role: roleSchema,
  departmentId: z.string().optional(),
});

export async function createUser(
  data: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  await requireAdmin();

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Dados inválidos";
    return { ok: false, error: msg };
  }

  const { name, email, password, role, departmentId } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "Já existe uma conta com este e-mail." };

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { name, email, passwordHash, role, approved: true },
    });
    if (role === "DEPARTAMENTO" && departmentId) {
      await tx.userDepartment.create({ data: { userId: u.id, departmentId } });
    }
    return u;
  });

  await recordAudit({
    userId: session?.user?.id,
    action: "CREATE",
    entity: "User",
    entityId: user.id,
    metadata: { name, email, role, departmentId: departmentId ?? null },
  });

  revalidatePath("/configuracoes/seguranca");
  return { ok: true };
}

export async function updateUserEmail(
  userId: string,
  newEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  await requireAdmin();

  const parsed = z.email("E-mail inválido").safeParse(newEmail.trim().toLowerCase());
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "E-mail inválido" };

  const existing = await prisma.user.findFirst({
    where: { email: parsed.data, NOT: { id: userId } },
  });
  if (existing) return { ok: false, error: "Este e-mail já está em uso por outro usuário." };

  await prisma.user.update({ where: { id: userId }, data: { email: parsed.data } });

  await recordAudit({
    userId: session?.user?.id,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    metadata: { action: "email_update", newEmail: parsed.data },
  });

  revalidatePath("/configuracoes/seguranca");
  return { ok: true };
}

export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  await requireAdmin();

  const parsed = passwordSchema.safeParse(newPassword);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Senha inválida" };
  }

  const passwordHash = await bcrypt.hash(parsed.data, 12);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
  });

  await recordAudit({
    userId: session?.user?.id,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    metadata: { action: "password_reset" },
  });

  return { ok: true };
}

export async function setUserRole(
  userId: string,
  role: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  await requireAdmin();

  const parsed = roleSchema.safeParse(role);
  if (!parsed.success) return { ok: false, error: "Papel inválido" };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { role: parsed.data } });
    if (parsed.data !== "DEPARTAMENTO") {
      await tx.userDepartment.deleteMany({ where: { userId } });
    }
  });

  await recordAudit({
    userId: session?.user?.id,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    metadata: { role: parsed.data },
  });

  revalidatePath("/configuracoes/seguranca");
  return { ok: true };
}

export async function setUserDepartment(
  userId: string,
  departmentId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  await requireAdmin();

  await prisma.$transaction(async (tx) => {
    await tx.userDepartment.deleteMany({ where: { userId } });
    if (departmentId) {
      await tx.userDepartment.create({ data: { userId, departmentId } });
    }
  });

  await recordAudit({
    userId: session?.user?.id,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    metadata: { departmentId: departmentId ?? "removido" },
  });

  revalidatePath("/configuracoes/seguranca");
  return { ok: true };
}

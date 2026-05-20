"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { roleSchema } from "@/lib/rbac";

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

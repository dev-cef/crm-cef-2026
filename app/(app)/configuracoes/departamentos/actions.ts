"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { MODULE_SLUGS, type ModuleSlug } from "@/lib/modules";

type ActionResult = { ok: boolean; error?: string };

const deptSchema = z.object({
  name:        z.string().trim().min(2, "Nome muito curto").max(60),
  slug:        z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/, "Apenas letras minúsculas, números e hífens"),
  description: z.string().trim().max(200).optional(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida").default("#6366f1"),
});

export async function criarDepartamento(raw: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = deptSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { name, slug, description, color } = parsed.data;
  try {
    const dept = await prisma.department.create({ data: { name, slug, description, color } });
    await recordAudit({ userId: admin.id, action: "CREATE", entity: "Department", entityId: dept.id, metadata: { name, slug } });
    revalidatePath("/configuracoes/departamentos");
    return { ok: true };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { ok: false, error: "Já existe um departamento com este slug." };
    }
    return { ok: false, error: "Erro ao criar departamento." };
  }
}

export async function editarDepartamento(id: string, raw: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = deptSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const { name, slug, description, color } = parsed.data;
  try {
    const before = await prisma.department.findUnique({ where: { id } });
    await prisma.department.update({ where: { id }, data: { name, slug, description, color } });
    await recordAudit({ userId: admin.id, action: "UPDATE", entity: "Department", entityId: id, metadata: { before, after: { name, slug, color } } });
    revalidatePath("/configuracoes/departamentos");
    return { ok: true };
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { ok: false, error: "Slug já em uso por outro departamento." };
    }
    return { ok: false, error: "Erro ao editar departamento." };
  }
}

export async function excluirDepartamento(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const users = await prisma.userDepartment.count({ where: { departmentId: id } });
  if (users > 0) return { ok: false, error: "Departamento possui usuários vinculados. Desvincule-os antes de excluir." };

  const dept = await prisma.department.findUnique({ where: { id } });
  if (!dept) return { ok: false, error: "Departamento não encontrado." };

  await prisma.department.delete({ where: { id } });
  await recordAudit({ userId: admin.id, action: "DELETE", entity: "Department", entityId: id, metadata: { name: dept.name } });
  revalidatePath("/configuracoes/departamentos");
  return { ok: true };
}

// Salva TODAS as permissões de um departamento de uma vez (upsert por módulo).
const permissionsSchema = z.record(
  z.enum(MODULE_SLUGS),
  z.object({
    canView:   z.boolean(),
    canEdit:   z.boolean(),
    canCreate: z.boolean(),
    canDelete: z.boolean(),
    canExport: z.boolean(),
  }),
);

export async function salvarPermissoesDept(
  departmentId: string,
  raw: unknown,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = permissionsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos." };

  const entries = Object.entries(parsed.data) as [ModuleSlug, {
    canView: boolean; canEdit: boolean; canCreate: boolean;
    canDelete: boolean; canExport: boolean;
  }][];

  await prisma.$transaction(
    entries.map(([moduleSlug, perms]) =>
      prisma.deptModulePermission.upsert({
        where: { departmentId_moduleSlug: { departmentId, moduleSlug } },
        update: { ...perms, updatedAt: new Date() },
        create: { departmentId, moduleSlug, ...perms },
      }),
    ),
  );

  await recordAudit({
    userId: admin.id,
    action: "UPDATE",
    entity: "DeptModulePermission",
    entityId: departmentId,
    metadata: { permissions: parsed.data },
  });
  revalidatePath("/configuracoes/departamentos");
  return { ok: true };
}

// Override individual de permissão para um usuário (ADMIN seta, sobrepõe dept).
export async function salvarOverrideUsuario(
  userId: string,
  moduleSlug: ModuleSlug,
  perms: {
    canView: boolean | null; canEdit: boolean | null;
    canCreate: boolean | null; canDelete: boolean | null;
    canExport: boolean | null;
  },
): Promise<ActionResult> {
  const admin = await requireAdmin();
  await prisma.userModuleOverride.upsert({
    where: { userId_moduleSlug: { userId, moduleSlug } },
    update: { ...perms, overriddenBy: admin.id, overriddenAt: new Date(), updatedAt: new Date() },
    create: { userId, moduleSlug, ...perms, overriddenBy: admin.id },
  });
  revalidatePath("/configuracoes/departamentos");
  return { ok: true };
}

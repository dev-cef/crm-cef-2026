"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { supplierSchema, type SupplierFormValues } from "@/lib/validations/supplier";

type Result = { ok: boolean; error?: string };

export async function saveSupplier(
  values: SupplierFormValues,
  id?: string,
): Promise<Result> {
  const session = await auth();
  const parsed = supplierSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Inválido" };
  }
  const d = parsed.data;
  const data = {
    name:     d.name,
    type:     d.type,
    phone:    d.phone?.trim() || null,
    email:    d.email?.trim() || null,
    document: d.document?.trim() || null,
    pix:      d.pix?.trim() || null,
    notes:    d.notes?.trim() || null,
    active:   d.active,
  };

  try {
    const supplier = id
      ? await prisma.supplier.update({ where: { id }, data })
      : await prisma.supplier.create({ data });

    await recordAudit({
      userId: session?.user?.id,
      action: id ? "UPDATE" : "CREATE",
      entity: "Supplier",
      entityId: supplier.id,
      metadata: { name: supplier.name, type: supplier.type },
    });

    revalidatePath("/fornecedores");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao salvar o fornecedor." };
  }
}

export async function toggleSupplier(id: string): Promise<Result> {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) return { ok: false, error: "Fornecedor não encontrado." };
  await prisma.supplier.update({
    where: { id },
    data: { active: !supplier.active },
  });
  revalidatePath("/fornecedores");
  return { ok: true };
}

export async function deleteSupplier(id: string): Promise<Result> {
  const session = await auth();
  const [txCount, evCount] = await Promise.all([
    prisma.transaction.count({ where: { supplierId: id } }),
    prisma.event.count({ where: { supplierId: id } }),
  ]);
  if (txCount > 0 || evCount > 0) {
    return {
      ok: false,
      error: `Fornecedor vinculado a ${txCount} transação(ões) e ${evCount} evento(s). Desvincule antes de excluir.`,
    };
  }
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    await prisma.supplier.delete({ where: { id } });
    await recordAudit({
      userId: session?.user?.id,
      action: "DELETE",
      entity: "Supplier",
      entityId: id,
      metadata: { name: supplier?.name },
    });
    revalidatePath("/fornecedores");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao excluir o fornecedor." };
  }
}

export async function getActiveSuppliers(): Promise<
  { id: string; name: string; type: string }[]
> {
  return prisma.supplier.findMany({
    where: { active: true },
    select: { id: true, name: true, type: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

// ─── Supplier Categories ──────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  "Transporte / Van",
  "Equipamentos",
  "Alimentação",
  "Serviços Gerais",
];

async function initDefaultSupplierCategories() {
  const count = await prisma.supplierCategory.count();
  if (count > 0) return;
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    await prisma.supplierCategory.create({
      data: { name: DEFAULT_CATEGORIES[i], order: i },
    });
  }
}

export async function getSupplierCategories(): Promise<
  { id: string; name: string; order: number }[]
> {
  await initDefaultSupplierCategories();
  return prisma.supplierCategory.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

export async function createSupplierCategory(name: string): Promise<Result> {
  const session = await auth();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Informe o nome da categoria." };
  try {
    const count = await prisma.supplierCategory.count();
    await prisma.supplierCategory.create({ data: { name: trimmed, order: count } });
    await recordAudit({
      userId: session?.user?.id,
      action: "CREATE",
      entity: "SupplierCategory",
      entityId: trimmed,
    });
    revalidatePath("/fornecedores/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Já existe uma categoria com este nome." };
  }
}

export async function renameSupplierCategory(id: string, name: string): Promise<Result> {
  const session = await auth();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Informe o nome da categoria." };
  try {
    await prisma.supplierCategory.update({ where: { id }, data: { name: trimmed } });
    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "SupplierCategory",
      entityId: id,
      metadata: { name: trimmed },
    });
    revalidatePath("/fornecedores/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Já existe uma categoria com este nome." };
  }
}

export async function deleteSupplierCategory(id: string): Promise<Result> {
  const session = await auth();
  const cat = await prisma.supplierCategory.findUnique({ where: { id } });
  if (!cat) return { ok: false, error: "Categoria não encontrada." };
  const inUse = await prisma.supplier.count({ where: { type: cat.name } });
  if (inUse > 0) {
    return { ok: false, error: `Categoria em uso por ${inUse} fornecedor(es). Reatribua antes de excluir.` };
  }
  try {
    await prisma.supplierCategory.delete({ where: { id } });
    await recordAudit({
      userId: session?.user?.id,
      action: "DELETE",
      entity: "SupplierCategory",
      entityId: id,
      metadata: { name: cat.name },
    });
    revalidatePath("/fornecedores/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao excluir a categoria." };
  }
}

export async function reorderSupplierCategories(orderedIds: string[]): Promise<Result> {
  try {
    await prisma.$transaction(
      orderedIds.map((id, i) =>
        prisma.supplierCategory.update({ where: { id }, data: { order: i } }),
      ),
    );
    revalidatePath("/fornecedores/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao reordenar." };
  }
}

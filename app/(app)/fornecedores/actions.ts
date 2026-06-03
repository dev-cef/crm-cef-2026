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

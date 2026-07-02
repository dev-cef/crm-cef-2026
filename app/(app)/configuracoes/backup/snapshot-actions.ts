"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

async function collectBackupData() {
  const [
    members, plans, payments, transactions, events, registrations, photos,
    departments, deptPermissions, userDepartments, users,
    birthdayConfig, systemConfig,
  ] = await Promise.all([
    prisma.member.findMany({ orderBy: { registration: "asc" } }),
    prisma.plan.findMany({ orderBy: { name: "asc" } }),
    prisma.payment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.transaction.findMany({ orderBy: { date: "asc" } }),
    prisma.event.findMany({ orderBy: { dateTime: "asc" } }),
    prisma.eventRegistration.findMany(),
    prisma.eventPhoto.findMany(),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.deptModulePermission.findMany(),
    prisma.userDepartment.findMany(),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, email: true, role: true, approved: true,
        totpEnabled: true, failedLoginAttempts: true, lockedUntil: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.messengerConfig.findMany(),
    prisma.systemConfig.findMany(),
  ]);

  return {
    users, departments, deptModulePermissions: deptPermissions,
    userDepartments, members, plans, payments, transactions, events,
    eventRegistrations: registrations, eventPhotos: photos,
    birthdayMessageConfig: birthdayConfig, systemConfig,
  };
}

export async function createSnapshot(
  label: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  await requireAdmin();

  if (!label.trim()) return { ok: false, error: "Informe um nome para o snapshot." };

  const data = await collectBackupData();
  const json = JSON.stringify({
    meta: { generatedAt: new Date().toISOString(), version: "1.0", system: "CRM CEF 2026" },
    data,
  });
  const sizeBytes = Buffer.byteLength(json, "utf8");

  await prisma.snapshot.create({
    data: {
      label: label.trim(),
      data: json,
      sizeBytes,
      createdById: session?.user?.id ?? null,
    },
  });

  await recordAudit({
    userId: session?.user?.id,
    action: "CREATE",
    entity: "Snapshot",
    entityId: label.trim(),
    metadata: { sizeBytes },
  });

  revalidatePath("/configuracoes/backup");
  return { ok: true };
}

export async function deleteSnapshot(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  await requireAdmin();

  const snap = await prisma.snapshot.findUnique({ where: { id } });
  if (!snap) return { ok: false, error: "Snapshot não encontrado." };

  await prisma.snapshot.delete({ where: { id } });

  await recordAudit({
    userId: session?.user?.id,
    action: "DELETE",
    entity: "Snapshot",
    entityId: id,
    metadata: { label: snap.label },
  });

  revalidatePath("/configuracoes/backup");
  return { ok: true };
}

export async function restoreSnapshot(
  id: string,
): Promise<{ ok: boolean; counts?: Record<string, number>; error?: string }> {
  const session = await auth();
  await requireAdmin();

  const snap = await prisma.snapshot.findUnique({ where: { id } });
  if (!snap) return { ok: false, error: "Snapshot não encontrado." };

  // Reutiliza a mesma lógica do restore de arquivo
  const { restoreBackup } = await import(
    "@/app/(app)/configuracoes/backup/restore-action"
  );
  const parsed = JSON.parse(snap.data);
  const result = await restoreBackup(parsed);

  if (result.ok) {
    await recordAudit({
      userId: session?.user?.id,
      action: "CREATE",
      entity: "SnapshotRestore",
      entityId: id,
      metadata: { label: snap.label, counts: result.counts },
    });
  }

  return result;
}

export async function listSnapshots() {
  await requireAdmin();
  return prisma.snapshot.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, sizeBytes: true, createdAt: true },
  });
}

"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import {
  generateRecoveryCodes,
  generateSecret,
  normalizeRecoveryCode,
  otpauthUri,
  verifyTotp,
} from "@/lib/totp";

const ISSUER = "CRM CEF";

export type EnrollStart = {
  ok: true;
  secret: string;
  uri: string;
  qr: string;
};

export async function startTotpEnrollment(): Promise<EnrollStart> {
  const user = await requireAdmin();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) throw new Error("Usuário não encontrado");

  const secret = generateSecret();
  // Guarda o segredo mas mantém desabilitado até confirmar com um código.
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: secret, totpEnabled: false },
  });

  const uri = otpauthUri({ secret, account: dbUser.email, issuer: ISSUER });
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { ok: true, secret, uri, qr };
}

export type ActionMsg = { ok: boolean; error?: string; codes?: string[] };

export async function confirmTotpEnrollment(
  code: string,
): Promise<ActionMsg> {
  const user = await requireAdmin();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.totpSecret) {
    return { ok: false, error: "Inicie a configuração novamente." };
  }
  if (!verifyTotp(dbUser.totpSecret, code)) {
    return { ok: false, error: "Código inválido. Tente novamente." };
  }

  const recovery = generateRecoveryCodes();
  const hashes = await Promise.all(
    recovery.map((c) => bcrypt.hash(normalizeRecoveryCode(c), 10)),
  );
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpRecoveryCodes: JSON.stringify(hashes) },
  });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    metadata: { event: "2fa_enabled" },
  });
  revalidatePath("/configuracoes/seguranca");
  return { ok: true, codes: recovery };
}

export async function disableTotp(code: string): Promise<ActionMsg> {
  const user = await requireAdmin();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.totpEnabled || !dbUser.totpSecret) {
    return { ok: false, error: "2FA não está ativo." };
  }

  let allowed = verifyTotp(dbUser.totpSecret, code);
  if (!allowed) {
    const hashes: string[] = JSON.parse(dbUser.totpRecoveryCodes || "[]");
    const norm = normalizeRecoveryCode(code);
    for (const h of hashes) {
      if (await bcrypt.compare(norm, h)) {
        allowed = true;
        break;
      }
    }
  }
  if (!allowed) {
    return { ok: false, error: "Código inválido — não foi possível desativar." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: false,
      totpSecret: null,
      totpRecoveryCodes: "[]",
    },
  });
  await recordAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "User",
    entityId: user.id,
    metadata: { event: "2fa_disabled" },
  });
  revalidatePath("/configuracoes/seguranca");
  return { ok: true };
}

export async function aprovarConta(userId: string): Promise<ActionMsg> {
  const admin = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { member: { select: { id: true } } },
  });
  if (!user || user.approved) {
    return { ok: false, error: "Conta inválida ou já aprovada." };
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { approved: true },
    });
    if (user.member) {
      await tx.member.update({
        where: { id: user.member.id },
        data: { status: "ACTIVE", inactiveReason: null, inactiveAt: null },
      });
    }
  });
  await recordAudit({
    userId: admin.id,
    action: "UPDATE",
    entity: "User",
    entityId: userId,
    metadata: { event: "account_approved" },
  });
  revalidatePath("/configuracoes/aprovacoes");
  return { ok: true };
}

export async function recusarConta(userId: string): Promise<ActionMsg> {
  const admin = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { member: { select: { id: true } } },
  });
  if (!user || user.approved) {
    return { ok: false, error: "Conta inválida ou já aprovada." };
  }
  // Recusa um auto-cadastro nunca aprovado: remove member (cascata em
  // pagamentos) e depois a conta.
  await prisma.$transaction(async (tx) => {
    if (user.member) {
      await tx.member.delete({ where: { id: user.member.id } });
    }
    await tx.user.delete({ where: { id: userId } });
  });
  await recordAudit({
    userId: admin.id,
    action: "DELETE",
    entity: "User",
    entityId: userId,
    metadata: { event: "account_rejected" },
  });
  revalidatePath("/configuracoes/aprovacoes");
  return { ok: true };
}

export async function regenerateRecoveryCodes(
  code: string,
): Promise<ActionMsg> {
  const user = await requireAdmin();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.totpEnabled || !dbUser.totpSecret) {
    return { ok: false, error: "2FA não está ativo." };
  }
  if (!verifyTotp(dbUser.totpSecret, code)) {
    return { ok: false, error: "Código inválido." };
  }
  const recovery = generateRecoveryCodes();
  const hashes = await Promise.all(
    recovery.map((c) => bcrypt.hash(normalizeRecoveryCode(c), 10)),
  );
  await prisma.user.update({
    where: { id: user.id },
    data: { totpRecoveryCodes: JSON.stringify(hashes) },
  });
  revalidatePath("/configuracoes/seguranca");
  return { ok: true, codes: recovery };
}

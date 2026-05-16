"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { buildBirthdayMessage, whatsappLink } from "@/lib/birthday";

export async function getBirthdayConfig() {
  let cfg = await prisma.birthdayMessageConfig.findFirst();
  if (!cfg) {
    cfg = await prisma.birthdayMessageConfig.create({ data: {} });
  }
  return cfg;
}

export async function saveBirthdayConfig(
  template: string,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (template.trim().length < 5) {
    return { ok: false, error: "O texto da mensagem é muito curto." };
  }
  const cfg = await getBirthdayConfig();
  await prisma.birthdayMessageConfig.update({
    where: { id: cfg.id },
    data: { template: template.trim(), enabled },
  });
  await recordAudit({
    userId: session?.user?.id,
    action: "UPDATE",
    entity: "BirthdayMessageConfig",
    entityId: cfg.id,
  });
  revalidatePath("/aniversariantes");
  return { ok: true };
}

export async function prepareWhatsApp(
  memberId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const session = await auth();
  const [member, cfg] = await Promise.all([
    prisma.member.findFirst({ where: { id: memberId, deletedAt: null } }),
    getBirthdayConfig(),
  ]);
  if (!member) return { ok: false, error: "Associado não encontrado." };

  const message = buildBirthdayMessage(cfg.template, member.fullName);
  const url = whatsappLink(member.phone, message);

  await prisma.birthdayMessageLog.create({
    data: { memberId: member.id, channel: "WHATSAPP" },
  });
  await recordAudit({
    userId: session?.user?.id,
    action: "CREATE",
    entity: "BirthdayMessageLog",
    entityId: member.id,
    metadata: { channel: "WHATSAPP" },
  });
  revalidatePath("/aniversariantes");
  return { ok: true, url };
}

export async function sendBirthdayEmail(
  memberId: string,
): Promise<{ ok: boolean; simulated?: boolean; error?: string }> {
  const session = await auth();
  const [member, cfg] = await Promise.all([
    prisma.member.findFirst({ where: { id: memberId, deletedAt: null } }),
    getBirthdayConfig(),
  ]);
  if (!member) return { ok: false, error: "Associado não encontrado." };

  const message = buildBirthdayMessage(cfg.template, member.fullName);
  const html = `<div style="font-family:sans-serif;max-width:480px;margin:auto">
    <div style="background:#18181b;color:#fff;padding:16px;border-radius:8px 8px 0 0">
      <strong>Clube Excursionista de Friburgo</strong>
    </div>
    <div style="border:1px solid #e4e4e7;border-top:0;padding:24px;border-radius:0 0 8px 8px">
      <p>${message}</p>
    </div>
  </div>`;

  let simulated = true;
  try {
    if (process.env.SMTP_HOST) {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
      await transport.sendMail({
        from: process.env.SMTP_FROM ?? "no-reply@cef.org.br",
        to: member.email,
        subject: "Feliz aniversário! 🎉 — CEF",
        html,
      });
      simulated = false;
    }
  } catch (e) {
    return {
      ok: false,
      error: `Falha no envio: ${String((e as Error).message)}`,
    };
  }

  await prisma.birthdayMessageLog.create({
    data: { memberId: member.id, channel: "EMAIL" },
  });
  await recordAudit({
    userId: session?.user?.id,
    action: "CREATE",
    entity: "BirthdayMessageLog",
    entityId: member.id,
    metadata: { channel: "EMAIL", simulated },
  });
  revalidatePath("/aniversariantes");
  return { ok: true, simulated };
}

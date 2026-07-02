"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { buildBirthdayMessage, whatsappLink } from "@/lib/birthday";
import { evolutionConfigured } from "@/lib/whatsapp";
import {
  getMessengerConfig,
  sendMessengerNotification,
  logMessengerAttempt,
} from "@/lib/messenger";

export async function prepareWhatsApp(
  memberId: string,
): Promise<{ ok: boolean; sent?: boolean; url?: string; error?: string }> {
  const session = await auth();
  const [member, cfg] = await Promise.all([
    prisma.member.findFirst({ where: { id: memberId, deletedAt: null } }),
    getMessengerConfig(),
  ]);
  if (!member) return { ok: false, error: "Associado não encontrado." };

  const phone = member.whatsapp ?? member.phone;
  const message = buildBirthdayMessage(cfg.template, member.fullName);

  // Tenta enviar via Evolution API; se não configurada, cai no link manual
  if (evolutionConfigured()) {
    const res = await sendMessengerNotification({
      type: "ANIVERSARIO",
      memberId: member.id,
      recipient: phone,
      message,
    });
    if (!res.ok) return { ok: false, error: `Falha no envio: ${res.error}` };
    await recordAudit({
      userId: session?.user?.id,
      action: "CREATE",
      entity: "MessageLog",
      entityId: member.id,
      metadata: { channel: "WHATSAPP", via: "evolution" },
    });
    revalidatePath("/aniversariantes");
    return { ok: true, sent: true };
  }

  // Fallback: link wa.me manual (abrir o link já conta como envio).
  const url = whatsappLink(phone, message);
  await logMessengerAttempt({
    type: "ANIVERSARIO",
    channel: "WHATSAPP",
    memberId: member.id,
    recipient: phone,
    status: "ENVIADO",
  });
  await recordAudit({
    userId: session?.user?.id,
    action: "CREATE",
    entity: "MessageLog",
    entityId: member.id,
    metadata: { channel: "WHATSAPP", via: "link" },
  });
  revalidatePath("/aniversariantes");
  return { ok: true, sent: false, url };
}

export async function sendBirthdayEmail(
  memberId: string,
): Promise<{ ok: boolean; simulated?: boolean; error?: string }> {
  const session = await auth();
  const [member, cfg] = await Promise.all([
    prisma.member.findFirst({ where: { id: memberId, deletedAt: null } }),
    getMessengerConfig(),
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
    await logMessengerAttempt({
      type: "ANIVERSARIO",
      channel: "EMAIL",
      memberId: member.id,
      recipient: member.email,
      status: "FALHA",
      errorMessage: String((e as Error).message ?? e),
    });
    return {
      ok: false,
      error: `Falha no envio: ${String((e as Error).message)}`,
    };
  }

  await logMessengerAttempt({
    type: "ANIVERSARIO",
    channel: "EMAIL",
    memberId: member.id,
    recipient: member.email,
    status: simulated ? "FALHA" : "ENVIADO",
    errorMessage: simulated ? "SMTP não configurado (simulado)" : null,
  });
  await recordAudit({
    userId: session?.user?.id,
    action: "CREATE",
    entity: "MessageLog",
    entityId: member.id,
    metadata: { channel: "EMAIL", simulated },
  });
  revalidatePath("/aniversariantes");
  return { ok: true, simulated };
}

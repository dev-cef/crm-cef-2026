"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const EXPIRY_MINUTES = 60;

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Informe seu e-mail." };

  const user = await prisma.user.findUnique({ where: { email } });

  // Responde igual independente de o e-mail existir (evita enumeração)
  if (!user) return { ok: true };

  // Invalida tokens anteriores não usados
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expiresAt },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const resetUrl = `${baseUrl}/redefinir-senha?token=${token}`;

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
      to: user.email,
      subject: "Redefinição de senha — CRM CEF",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#0f172a">Redefinir sua senha</h2>
          <p>Olá, <strong>${user.name}</strong>.</p>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta no CRM CEF.</p>
          <p style="margin:24px 0">
            <a href="${resetUrl}"
               style="background:#0ea5e9;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Redefinir senha
            </a>
          </p>
          <p style="color:#64748b;font-size:13px">
            O link expira em ${EXPIRY_MINUTES} minutos. Se você não solicitou isso, ignore este e-mail.
          </p>
        </div>
      `,
    });
  } else {
    // Sem SMTP configurado: loga o link para facilitar testes locais
    console.log("[password-reset] link:", resetUrl);
  }

  return { ok: true };
}

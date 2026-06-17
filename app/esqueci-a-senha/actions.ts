"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const EXPIRY_MINUTES = 60;

function getBaseUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function sendResetEmail(to: string, name: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("[password-reset] RESEND_API_KEY não configurado. Link:", resetUrl);
    return;
  }

  const from = process.env.SMTP_FROM ?? "CRM CEF <onboarding@resend.dev>";

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#0f172a">Redefinir sua senha</h2>
      <p>Olá, <strong>${name}</strong>.</p>
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
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Redefinição de senha — CRM CEF",
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Informe seu e-mail." };

  const user = await prisma.user.findUnique({ where: { email } });

  // Responde igual independente de o e-mail existir (evita enumeração)
  if (!user) return { ok: true };

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { token, userId: user.id, expiresAt },
  });

  const resetUrl = `${getBaseUrl()}/redefinir-senha?token=${token}`;

  try {
    await sendResetEmail(user.email, user.name, resetUrl);
  } catch (err) {
    console.error("[password-reset] falha ao enviar e-mail:", err);
    // Não vazar o erro para o usuário — o token já foi criado
    // e um admin pode reenviar manualmente se necessário
  }

  return { ok: true };
}

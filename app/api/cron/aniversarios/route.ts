import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildBirthdayMessage, buildEmailHtml } from "@/lib/birthday";
import { evolutionConfigured } from "@/lib/whatsapp";
import {
  getMessengerConfig,
  sendMessengerNotification,
  logMessengerAttempt,
} from "@/lib/messenger";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await getMessengerConfig();
  if (!config.enabled) {
    return NextResponse.json({ skipped: "disabled" });
  }

  const today = new Date();
  const todayMonth = today.getUTCMonth() + 1;
  const todayDay   = today.getUTCDate();

  const members = await prisma.member.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: { id: true, fullName: true, email: true, phone: true, whatsapp: true, birthDate: true },
  });

  const birthdayMembers = members.filter((m) => {
    const d = new Date(m.birthDate);
    return d.getUTCMonth() + 1 === todayMonth && d.getUTCDate() === todayDay;
  });

  if (birthdayMembers.length === 0) {
    return NextResponse.json({ email: { sent: 0, skipped: 0, failed: 0 }, whatsapp: { sent: 0, skipped: 0, failed: 0 } });
  }

  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const todayEnd   = new Date(todayStart.getTime() + 86_400_000);

  // Dedup por canal separadamente
  const alreadySentLogs = await prisma.messageLog.findMany({
    where: {
      type: "ANIVERSARIO",
      status: "ENVIADO",
      sentAt: { gte: todayStart, lt: todayEnd },
      memberId: { in: birthdayMembers.map((m) => m.id) },
    },
    select: { memberId: true, channel: true },
  });
  const sentEmail    = new Set(alreadySentLogs.filter((l) => l.channel === "EMAIL").map((l) => l.memberId));
  const sentWhatsApp = new Set(alreadySentLogs.filter((l) => l.channel === "WHATSAPP").map((l) => l.memberId));

  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.SMTP_FROM ?? "CEF <noreply@cef.org.br>";
  const useEvolution = evolutionConfigured();

  let emailSent = 0, emailFailed = 0;
  let waSent = 0, waFailed = 0;

  for (const member of birthdayMembers) {
    const message = buildBirthdayMessage(config.template, member.fullName);

    // ── E-mail ──────────────────────────────────────────────────────────────
    if (!sentEmail.has(member.id)) {
      if (!apiKey) {
        // Sem provedor configurado, não finge sucesso: registra como falha visível.
        await logMessengerAttempt({
          type: "ANIVERSARIO",
          channel: "EMAIL",
          memberId: member.id,
          recipient: member.email,
          status: "FALHA",
          errorMessage: "RESEND_API_KEY não configurada (simulado)",
        });
        emailFailed++;
      } else {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: member.email, subject: "Feliz aniversário! 🎉 — CEF", html: buildEmailHtml(message) }),
          });
          if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
          await logMessengerAttempt({
            type: "ANIVERSARIO",
            channel: "EMAIL",
            memberId: member.id,
            recipient: member.email,
            status: "ENVIADO",
          });
          emailSent++;
        } catch (e) {
          await logMessengerAttempt({
            type: "ANIVERSARIO",
            channel: "EMAIL",
            memberId: member.id,
            recipient: member.email,
            status: "FALHA",
            errorMessage: String((e as Error).message ?? e),
          });
          emailFailed++;
        }
      }
    }

    // ── WhatsApp via Evolution API ───────────────────────────────────────────
    if (!sentWhatsApp.has(member.id) && useEvolution) {
      const phone = member.whatsapp ?? member.phone;
      const res = await sendMessengerNotification({
        type: "ANIVERSARIO",
        memberId: member.id,
        recipient: phone,
        message,
      });
      if (res.ok) waSent++;
      else waFailed++;
    }
  }

  return NextResponse.json({
    email:    { sent: emailSent,    skipped: sentEmail.size,    failed: emailFailed },
    whatsapp: { sent: waSent,       skipped: sentWhatsApp.size, failed: waFailed    },
  });
}

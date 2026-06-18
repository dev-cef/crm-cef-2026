import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildBirthdayMessage, buildEmailHtml } from "@/lib/birthday";
import { sendWhatsAppMessage, evolutionConfigured } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await prisma.birthdayMessageConfig.findFirst();
  if (!config?.enabled) {
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
  const alreadySentLogs = await prisma.birthdayMessageLog.findMany({
    where: {
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
      try {
        if (apiKey) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: member.email, subject: "Feliz aniversário! 🎉 — CEF", html: buildEmailHtml(message) }),
          });
          if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
        }
        await prisma.birthdayMessageLog.create({ data: { memberId: member.id, channel: "EMAIL" } });
        emailSent++;
      } catch {
        emailFailed++;
      }
    }

    // ── WhatsApp via Evolution API ───────────────────────────────────────────
    if (!sentWhatsApp.has(member.id) && useEvolution) {
      try {
        const phone = member.whatsapp ?? member.phone;
        await sendWhatsAppMessage(phone, message);
        await prisma.birthdayMessageLog.create({ data: { memberId: member.id, channel: "WHATSAPP" } });
        waSent++;
      } catch {
        waFailed++;
      }
    }
  }

  return NextResponse.json({
    email:    { sent: emailSent,    skipped: sentEmail.size,    failed: emailFailed },
    whatsapp: { sent: waSent,       skipped: sentWhatsApp.size, failed: waFailed    },
  });
}

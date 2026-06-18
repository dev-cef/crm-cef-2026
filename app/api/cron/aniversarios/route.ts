import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildBirthdayMessage, buildEmailHtml } from "@/lib/birthday";

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
  const todayDay = today.getUTCDate();

  const members = await prisma.member.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: { id: true, fullName: true, email: true, birthDate: true },
  });

  const birthdayMembers = members.filter((m) => {
    const d = new Date(m.birthDate);
    return d.getUTCMonth() + 1 === todayMonth && d.getUTCDate() === todayDay;
  });

  if (birthdayMembers.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, failed: 0 });
  }

  // Dedup: skip members who already received an email today
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  const alreadySent = await prisma.birthdayMessageLog.findMany({
    where: {
      channel: "EMAIL",
      sentAt: { gte: todayStart, lt: todayEnd },
      memberId: { in: birthdayMembers.map((m) => m.id) },
    },
    select: { memberId: true },
  });
  const sentSet = new Set(alreadySent.map((l) => l.memberId));

  const toSend = birthdayMembers.filter((m) => !sentSet.has(m.id));
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SMTP_FROM ?? "CEF <noreply@cef.org.br>";

  let sent = 0;
  let failed = 0;

  for (const member of toSend) {
    try {
      const message = buildBirthdayMessage(config.template, member.fullName);
      const html = buildEmailHtml(message);

      if (apiKey) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: member.email,
            subject: "Feliz aniversário! 🎉 — CEF",
            html,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend ${res.status}: ${body}`);
        }
      }
      // If no API key configured, log the send anyway (useful for dev/testing)

      await prisma.birthdayMessageLog.create({
        data: { memberId: member.id, channel: "EMAIL" },
      });
      sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ sent, skipped: sentSet.size, failed });
}

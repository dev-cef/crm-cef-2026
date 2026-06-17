import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toBrDate } from "@/lib/format";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const eventWhere: Record<string, unknown> = { eventCategory: "ATIVIDADE" };
  if (from || to) {
    eventWhere.dateTime = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to)   } : {}),
    };
  }

  const [registrations, attendees] = await Promise.all([
    prisma.eventRegistration.findMany({
      where: { event: eventWhere },
      include: {
        member: { select: { id: true, registration: true, fullName: true, plan: { select: { name: true } } } },
        event:  { select: { id: true, name: true, dateTime: true, categoryCode: true, location: true } },
      },
      orderBy: [{ event: { dateTime: "desc" } }, { member: { fullName: "asc" } }],
    }),
    prisma.eventAttendee.findMany({
      where: { event: eventWhere },
      select: { eventId: true, memberId: true },
    }),
  ]);

  // Set of "eventId:memberId" for O(1) presence lookup
  const presentSet = new Set(attendees.map((a) => `${a.eventId}:${a.memberId}`));

  const header = [
    "Matrícula",
    "Associado",
    "Plano",
    "Atividade",
    "Categoria",
    "Data",
    "Local",
    "Presença",
  ];

  const rows = registrations.map((r) => {
    const presente = presentSet.has(`${r.event.id}:${r.member.id}`);
    return [
      r.member.registration,
      r.member.fullName,
      r.member.plan?.name ?? "",
      r.event.name,
      r.event.categoryCode ?? "",
      toBrDate(r.event.dateTime),
      r.event.location,
      presente ? "Presente" : "Inscrito",
    ].map(csvCell).join(";");
  });

  const csv = "﻿" + [header.join(";"), ...rows].join("\r\n");
  const now = new Date();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participacao-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.csv"`,
    },
  });
}

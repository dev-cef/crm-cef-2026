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

  const attendees = await prisma.eventAttendee.findMany({
    where: { event: eventWhere },
    include: {
      member: { select: { registration: true, fullName: true, plan: { select: { name: true } } } },
      event: { select: { name: true, dateTime: true, categoryCode: true, location: true } },
    },
    orderBy: [{ event: { dateTime: "desc" } }, { member: { fullName: "asc" } }],
  });

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

  const rows = attendees.map((a) =>
    [
      a.member.registration,
      a.member.fullName,
      a.member.plan?.name ?? "",
      a.event.name,
      a.event.categoryCode ?? "",
      toBrDate(a.event.dateTime),
      a.event.location,
      "Presente",
    ].map(csvCell).join(";"),
  );

  const csv = "﻿" + [header.join(";"), ...rows].join("\r\n");
  const now = new Date();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participacao-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.csv"`,
    },
  });
}

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
  const to = searchParams.get("to");

  const where: Record<string, unknown> = { eventCategory: "ATIVIDADE" };
  if (from || to) {
    where.dateTime = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to)   } : {}),
    };
  }

  const events = await prisma.event.findMany({
    where,
    include: {
      _count: { select: { registrations: true, attendees: true } },
    },
    orderBy: { dateTime: "desc" },
  });

  const header = [
    "Nome",
    "Categoria",
    "Data",
    "Status",
    "Vagas",
    "Inscritos",
    "Presentes",
    "Local",
  ];

  const rows = events.map((e) => {
    const guideIds: string[] = (() => {
      try { return JSON.parse(e.guideIds); } catch { return []; }
    })();
    return [
      e.name,
      e.categoryCode ?? "",
      toBrDate(e.dateTime),
      e.status,
      e.slots > 0 ? e.slots : "Ilimitadas",
      e._count.registrations,
      e._count.attendees,
      e.location,
    ].map(csvCell).join(";");
  });

  const csv = "﻿" + [header.join(";"), ...rows].join("\r\n");
  const now = new Date();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="atividades-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.csv"`,
    },
  });
}

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
      guide:  { select: { fullName: true } },
    },
    orderBy: { dateTime: "desc" },
  });

  // Fetch names for multi-guide events in bulk
  const allGuideIds = events.flatMap((e) => {
    try { return JSON.parse(e.guideIds) as string[]; } catch { return []; }
  });
  const uniqueIds = [...new Set(allGuideIds)];
  const guideMap = new Map<string, string>();
  if (uniqueIds.length > 0) {
    const guides = await prisma.member.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, fullName: true },
    });
    for (const g of guides) guideMap.set(g.id, g.fullName);
  }

  const header = [
    "Nome",
    "Categoria",
    "Data",
    "Status",
    "Vagas",
    "Inscritos",
    "Presentes",
    "Local",
    "Guia(s)",
  ];

  const rows = events.map((e) => {
    const extraGuideIds: string[] = (() => {
      try { return JSON.parse(e.guideIds) as string[]; } catch { return []; }
    })();
    const guideNames = [
      ...(e.guide ? [e.guide.fullName] : []),
      ...extraGuideIds.filter((id) => id !== e.guideId).map((id) => guideMap.get(id) ?? id),
    ];
    return [
      e.name,
      e.categoryCode ?? "",
      toBrDate(e.dateTime),
      e.status,
      e.slots > 0 ? e.slots : "Ilimitadas",
      e._count.registrations,
      e._count.attendees,
      e.location,
      guideNames.join(", "),
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

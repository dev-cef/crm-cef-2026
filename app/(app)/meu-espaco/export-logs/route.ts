import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { toBrDate } from "@/lib/format";

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// LGPD — direito de acesso: o associado baixa apenas os próprios registros.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  const memberId = session.user.memberId;

  const or: { userId?: string; entityId?: string; entity?: string }[] = [
    { userId },
  ];
  if (memberId) or.push({ entity: "Member", entityId: memberId });

  const logs = await prisma.auditLog.findMany({
    where: { OR: or },
    orderBy: { createdAt: "desc" },
  });

  const header = ["Data/Hora", "Ação", "Entidade", "Registro", "IP", "Detalhes"];
  const rows = logs.map((l) =>
    [
      toBrDate(l.createdAt) + " " + l.createdAt.toLocaleTimeString("pt-BR"),
      l.action,
      l.entity,
      l.entityId,
      l.ip ?? "",
      l.metadata ?? "",
    ]
      .map(csvCell)
      .join(";"),
  );

  const csv = "﻿" + [header.join(";"), ...rows].join("\r\n");

  // O próprio ato de exportar é auditável (LGPD).
  await recordAudit({
    userId,
    action: "EXPORT",
    entity: "AuditLog",
    entityId: memberId ?? userId,
    metadata: { scope: "self", count: logs.length },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="meus-registros-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}

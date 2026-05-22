import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { monthName, toBrDate } from "@/lib/format";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const month =
    Number(searchParams.get("month") ?? now.getMonth() + 1) ||
    now.getMonth() + 1;
  const year =
    Number(searchParams.get("year") ?? now.getFullYear()) ||
    now.getFullYear();
  const planId = searchParams.get("planId") ?? "ALL";
  const status = searchParams.get("status") ?? "ALL";

  const where: Record<string, unknown> = {
    referenceMonth: month,
    referenceYear: year,
    member: { deletedAt: null, status: "ACTIVE" },
  };
  if (planId !== "ALL") where.planId = planId;
  if (["PAGO", "PENDENTE", "ATRASADO"].includes(status))
    where.status = status;

  const payments = await prisma.payment.findMany({
    where,
    include: {
      member: { select: { fullName: true, registration: true } },
      plan: { select: { name: true } },
    },
    orderBy: { member: { fullName: "asc" } },
  });

  const header = [
    "Matrícula",
    "Associado",
    "Plano",
    "Referência",
    "Valor",
    "Vencimento",
    "Pago em",
    "Status",
  ];
  const rows = payments.map((p) =>
    [
      p.member.registration,
      p.member.fullName,
      p.plan?.name ?? "",
      `${monthName(p.referenceMonth)}/${p.referenceYear}`,
      p.amount.toFixed(2).replace(".", ","),
      toBrDate(p.dueDate),
      p.paidAt ? toBrDate(p.paidAt) : "",
      p.status,
    ]
      .map(csvCell)
      .join(";"),
  );

  const csv = "﻿" + [header.join(";"), ...rows].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pagamentos-${year}-${String(
        month,
      ).padStart(2, "0")}.csv"`,
    },
  });
}

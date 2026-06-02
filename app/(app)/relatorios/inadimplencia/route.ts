import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { monthName } from "@/lib/format";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const overduePayments = await prisma.payment.findMany({
    where: {
      status: "ATRASADO",
      member: { deletedAt: null, status: "ACTIVE" },
    },
    include: {
      member: { select: { registration: true, fullName: true, phone: true, email: true } },
      plan:   { select: { name: true } },
    },
    orderBy: [{ member: { fullName: "asc" } }, { referenceYear: "asc" }, { referenceMonth: "asc" }],
  });

  // Group by member
  const byMember = new Map<string, {
    registration: number;
    fullName: string;
    phone: string;
    email: string;
    plan: string;
    months: string[];
    total: number;
  }>();

  for (const p of overduePayments) {
    const key = p.memberId;
    if (!byMember.has(key)) {
      byMember.set(key, {
        registration: p.member.registration,
        fullName: p.member.fullName,
        phone: p.member.phone,
        email: p.member.email,
        plan: p.plan?.name ?? "",
        months: [],
        total: 0,
      });
    }
    const entry = byMember.get(key)!;
    entry.months.push(`${monthName(p.referenceMonth)}/${p.referenceYear}`);
    entry.total += p.amount;
  }

  const header = [
    "Matrícula",
    "Associado",
    "Telefone",
    "E-mail",
    "Plano",
    "Meses em atraso",
    "Referências",
    "Total devido (R$)",
  ];

  const rows = [...byMember.values()].map((m) =>
    [
      m.registration,
      m.fullName,
      m.phone,
      m.email,
      m.plan,
      m.months.length,
      m.months.join(", "),
      m.total.toFixed(2).replace(".", ","),
    ].map(csvCell).join(";"),
  );

  const csv = "﻿" + [header.join(";"), ...rows].join("\r\n");
  const now = new Date();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inadimplencia-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.csv"`,
    },
  });
}

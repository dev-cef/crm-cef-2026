import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasAtLeast, scopedMemberWhere, toSessionUser } from "@/lib/rbac";
import { formatCpf, stripCpf } from "@/lib/cpf";
import { toBrDate } from "@/lib/format";

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!hasAtLeast(session.user, "DEPARTAMENTO")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const user = toSessionUser(session.user);

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const status = searchParams.get("status") ?? "ALL";

  const where: Record<string, unknown> = {
    deletedAt: null,
    ...scopedMemberWhere(user),
  };
  if (status === "ACTIVE" || status === "INACTIVE") where.status = status;
  if (q) {
    const digits = stripCpf(q);
    where.OR = [
      { fullName: { contains: q } },
      { email: { contains: q } },
      ...(digits ? [{ cpf: { contains: digits } }] : []),
    ];
  }

  const members = await prisma.member.findMany({
    where,
    include: { plan: true },
    orderBy: { fullName: "asc" },
  });

  const header = [
    "Matrícula",
    "Nome",
    "CPF",
    "Sexo",
    "Email",
    "Telefone",
    "Nascimento",
    "Cidade",
    "UF",
    "Plano",
    "Status",
  ];

  const rows = members.map((m) =>
    [
      m.registration,
      m.fullName,
      formatCpf(m.cpf),
      m.sex,
      m.email,
      m.phone,
      toBrDate(m.birthDate),
      m.city,
      m.state,
      m.plan?.name ?? "",
      m.status === "ACTIVE" ? "Ativo" : "Inativo",
    ]
      .map(csvCell)
      .join(";"),
  );

  const csv = "﻿" + [header.join(";"), ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="associados-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}

import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasAtLeast, scopedMemberWhere, toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { formatCpf, stripCpf } from "@/lib/cpf";
import { toBrDate, calculateAge } from "@/lib/format";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!hasAtLeast(session.user, "DEPARTAMENTO"))
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const user = toSessionUser(session.user);
  if (!(await can(user, "associados", "export")))
    return NextResponse.json({ error: "Sem permissão para exportar" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const status = searchParams.get("status") ?? "ALL";

  const where: Record<string, unknown> = { deletedAt: null, ...scopedMemberWhere(user) };
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

  // ── Workbook ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "CRM CEF";
  wb.created = new Date();

  const ws = wb.addWorksheet("Associados", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // ── Colunas ─────────────────────────────────────────────────────────
  ws.columns = [
    { key: "registration", width: 12 },
    { key: "fullName",     width: 36 },
    { key: "cpf",          width: 18 },
    { key: "sex",          width: 12 },
    { key: "birthDate",    width: 14 },
    { key: "age",          width: 10 },
    { key: "email",        width: 32 },
    { key: "phone",        width: 18 },
    { key: "city",         width: 22 },
    { key: "state",        width: 8 },
    { key: "cep",          width: 14 },
    { key: "street",       width: 36 },
    { key: "number",       width: 10 },
    { key: "neighborhood", width: 22 },
    { key: "plan",         width: 22 },
    { key: "status",       width: 12 },
    { key: "createdAt",    width: 16 },
  ];

  // ── Cabeçalho ────────────────────────────────────────────────────────
  const HEADERS = [
    "Matrícula", "Nome", "CPF", "Sexo", "Nascimento", "Idade", "E-mail",
    "Telefone", "Cidade", "UF", "CEP", "Logradouro", "Número", "Bairro",
    "Plano", "Status", "Cadastro",
  ];

  const headerRow = ws.addRow(HEADERS);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF1D4ED8" } },
    };
  });

  // ── Linhas ───────────────────────────────────────────────────────────
  members.forEach((m, idx) => {
    const isActive = m.status === "ACTIVE";
    const row = ws.addRow({
      registration: m.registration,
      fullName: m.fullName,
      cpf: formatCpf(m.cpf),
      sex: m.sex === "M" ? "Masculino" : "Feminino",
      birthDate: toBrDate(m.birthDate),
      age: calculateAge(m.birthDate),
      email: m.email,
      phone: m.phone,
      city: m.city,
      state: m.state,
      cep: m.cep,
      street: m.street,
      number: m.number,
      neighborhood: m.neighborhood,
      plan: m.plan?.name ?? "—",
      status: isActive ? "Ativo" : "Inativo",
      createdAt: toBrDate(m.createdAt),
    });

    const bg = idx % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF";
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
    });

    // Status colorido
    const statusCell = row.getCell("status");
    statusCell.font = {
      bold: true,
      color: { argb: isActive ? "FF15803D" : "FFB91C1C" },
    };
    statusCell.alignment = { vertical: "middle", horizontal: "center" };
  });

  // ── Auto-filtro no cabeçalho ─────────────────────────────────────────
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };

  // ── Buffer ───────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="associados-${date}.xlsx"`,
    },
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { calculateAge, monthName } from "@/lib/format";
import { isBirthdayInPeriod, type BirthdayPeriod } from "@/lib/birthday";

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  if (/[";\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ddmm(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(
    d.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const today = new Date();
  const period = (
    ["dia", "semana", "mes"].includes(searchParams.get("period") ?? "")
      ? searchParams.get("period")
      : "mes"
  ) as BirthdayPeriod;
  const month = Math.min(
    12,
    Math.max(
      1,
      Number(searchParams.get("month") ?? today.getMonth() + 1) ||
        today.getMonth() + 1,
    ),
  );
  const sex = searchParams.get("sex") ?? "ALL";
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const format = searchParams.get("format") === "txt" ? "txt" : "csv";

  const members = await prisma.member.findMany({
    where: { deletedAt: null },
    select: {
      fullName: true,
      sex: true,
      phone: true,
      instagram: true,
      whatsapp: true,
      birthDate: true,
    },
  });

  const list = members
    .filter((m) =>
      isBirthdayInPeriod(new Date(m.birthDate), period, month, today),
    )
    .filter((m) => (sex === "M" || sex === "F" ? m.sex === sex : true))
    .filter((m) => (q ? m.fullName.toLowerCase().includes(q) : true))
    .sort((a, b) => {
      const da = new Date(a.birthDate);
      const db = new Date(b.birthDate);
      return (
        da.getUTCMonth() - db.getUTCMonth() ||
        da.getUTCDate() - db.getUTCDate()
      );
    });

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "txt") {
    const title = `Aniversariantes — ${
      period === "mes"
        ? monthName(month)
        : period === "dia"
          ? "hoje"
          : "próximos 7 dias"
    }`;
    const lines = list.map((m) => {
      const age = calculateAge(new Date(m.birthDate));
      return `${ddmm(new Date(m.birthDate))} — ${m.fullName} (${age} anos)${
        m.phone ? ` — ${m.phone}` : ""
      }`;
    });
    const txt = [title, "=".repeat(title.length), "", ...lines, ""].join(
      "\n",
    );
    return new NextResponse(txt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="aniversariantes-${
          period === "mes" ? monthName(month).toLowerCase() : period
        }-${stamp}.txt"`,
      },
    });
  }

  const header = [
    "Nome",
    "Dia",
    "Mês",
    "Idade",
    "Sexo",
    "Instagram",
    "WhatsApp",
    "Telefone",
  ];
  const rows = list.map((m) => {
    const d = new Date(m.birthDate);
    return [
      m.fullName,
      String(d.getUTCDate()).padStart(2, "0"),
      monthName(d.getUTCMonth() + 1),
      calculateAge(d),
      m.sex === "F" ? "Feminino" : "Masculino",
      m.instagram ?? "",
      m.whatsapp ?? "",
      m.phone,
    ]
      .map(csvCell)
      .join(";");
  });

  const csv = "﻿" + [header.join(";"), ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aniversariantes-${stamp}.csv"`,
    },
  });
}

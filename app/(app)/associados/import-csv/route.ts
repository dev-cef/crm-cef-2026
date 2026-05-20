import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasAtLeast, toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { stripCpf, isValidCpf } from "@/lib/cpf";
import { parseBrDate, formatPersonName } from "@/lib/format";
import { BLOOD_TYPES, UF_OPTIONS } from "@/lib/constants";

type RowResult =
  | { row: number; name: string; ok: true }
  | { row: number; name: string; ok: false; error: string };

function splitLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === sep && !inQ) {
      result.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = splitLine(lines[0], sep).map((h) =>
    h.trim().replace(/^﻿/, "").toLowerCase().replace(/\s+/g, "_"),
  );
  return lines.slice(1).map((line) => {
    const vals = splitLine(line, sep);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? ""]));
  });
}

const VALID_EXPERIENCES = ["NUNCA", "MENOS_1", "MAIS_1", "MAIS_5", "MAIS_10", "PARADO"];

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!hasAtLeast(session.user, "DEPARTAMENTO"))
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const sessionUser = toSessionUser(session.user);
  if (!(await can(sessionUser, "associados", "create")))
    return NextResponse.json({ error: "Sem permissão para criar associados" }, { status: 403 });

  let text: string;
  try {
    const fd = await request.formData();
    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 400 });
    text = await file.text();
  } catch {
    return NextResponse.json({ error: "Erro ao ler arquivo" }, { status: 400 });
  }

  const rows = parseCSV(text);
  if (rows.length === 0)
    return NextResponse.json({ error: "CSV vazio ou sem dados válidos" }, { status: 400 });

  const plans = await prisma.plan.findMany({ where: { active: true } });
  const results: RowResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const name = row.nome ?? "";

    try {
      const required = [
        "nome", "sexo", "email", "telefone", "data_nascimento", "cpf",
        "cep", "logradouro", "numero", "bairro", "cidade", "estado",
        "tipo_sanguineo", "contato_emergencia_nome", "contato_emergencia_tel",
      ];
      const missing = required.filter((f) => !row[f]?.trim());
      if (missing.length > 0) {
        results.push({ row: rowNum, name, ok: false, error: `Campos ausentes: ${missing.join(", ")}` });
        continue;
      }

      if (!isValidCpf(row.cpf)) {
        results.push({ row: rowNum, name, ok: false, error: "CPF inválido" });
        continue;
      }

      const birthDate = parseBrDate(row.data_nascimento);
      if (!birthDate) {
        results.push({ row: rowNum, name, ok: false, error: "Data de nascimento inválida (DD/MM/AAAA)" });
        continue;
      }

      const sex = row.sexo.toUpperCase();
      if (sex !== "M" && sex !== "F") {
        results.push({ row: rowNum, name, ok: false, error: "Sexo deve ser M ou F" });
        continue;
      }

      const bloodType = row.tipo_sanguineo.toUpperCase();
      if (!BLOOD_TYPES.includes(bloodType as (typeof BLOOD_TYPES)[number])) {
        results.push({ row: rowNum, name, ok: false, error: `Tipo sanguíneo inválido: "${row.tipo_sanguineo}"` });
        continue;
      }

      const state = row.estado.toUpperCase();
      if (!UF_OPTIONS.includes(state as (typeof UF_OPTIONS)[number])) {
        results.push({ row: rowNum, name, ok: false, error: `Estado inválido: "${row.estado}"` });
        continue;
      }

      const expRaw = row.experiencia_montanha?.toUpperCase() ?? "";
      const mountainExperience = VALID_EXPERIENCES.includes(expRaw) ? expRaw : "NUNCA";

      const planName = row.plano?.trim();
      const planId = planName
        ? (plans.find((p) => p.name.toLowerCase() === planName.toLowerCase())?.id ?? null)
        : null;

      const cepDigits = row.cep.replace(/\D/g, "");
      const cep = cepDigits.length === 8 ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}` : row.cep;

      const member = await prisma.$transaction(async (tx) => {
        const agg = await tx.member.aggregate({ _max: { registration: true } });
        const nextReg = (agg._max.registration ?? 999) + 1;
        return tx.member.create({
          data: {
            registration: nextReg,
            fullName: formatPersonName(row.nome),
            sex,
            email: row.email.toLowerCase().trim(),
            phone: row.telefone.trim(),
            birthDate,
            cpf: stripCpf(row.cpf),
            cep,
            street: row.logradouro.trim(),
            number: row.numero.trim(),
            complement: row.complemento?.trim() || null,
            neighborhood: row.bairro.trim(),
            city: row.cidade.trim(),
            state,
            bloodType,
            emergencyName: formatPersonName(row.contato_emergencia_nome),
            emergencyPhone: row.contato_emergencia_tel.trim(),
            healthConditions: "[]",
            mountainExperience,
            interestHiking: 1,
            interestClimbing: 1,
            interestCourse: 1,
            interestBike: 1,
            interestEcological: 1,
            planId,
            status: "ACTIVE",
          },
        });
      });

      await recordAudit({
        userId: session.user.id,
        action: "CREATE",
        entity: "Member",
        entityId: member.id,
        metadata: { fullName: member.fullName, registration: member.registration, via: "csv_import" },
      });

      results.push({ row: rowNum, name: member.fullName, ok: true });
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      let error = "Erro ao criar associado";
      if (msg.includes("Member_cpf_key") || msg.includes("cpf")) error = "CPF já cadastrado";
      else if (msg.includes("email")) error = "E-mail já cadastrado";
      else if (msg.includes("P2002") || msg.includes("Unique")) error = "Registro duplicado";
      results.push({ row: rowNum, name, ok: false, error });
    }
  }

  revalidatePath("/associados");
  revalidatePath("/dashboard");

  return NextResponse.json({
    created: results.filter((r) => r.ok).length,
    errors: results.filter((r) => !r.ok).length,
    results,
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { gerarCodigoBem } from "@/lib/patrimonio/utils";
import { getBens } from "@/lib/patrimonio/queries";
import type { BemFilters, PatrimonioStatus, MovimentacaoTipo } from "@/lib/patrimonio/types";

type Result = { ok: boolean; error?: string; id?: string };

const bemSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  categoria: z.enum(["equipamento", "movel_utensilio", "eletronico"]),
  estado: z.enum(["otimo", "bom", "regular", "danificado", "descartado"]).default("bom"),
  status: z.enum(["disponivel", "em_uso", "manutencao", "emprestado", "baixado"]).default("disponivel"),
  descricao: z.string().optional(),
  marca: z.string().optional(),
  modelo: z.string().optional(),
  numeroSerie: z.string().optional(),
  localId: z.string().optional(),
  responsavelId: z.string().optional(),
  valorAquisicao: z.coerce.number().optional(),
  dataAquisicao: z.string().optional(),
  notaFiscal: z.string().optional(),
  fornecedor: z.string().optional(),
  vidaUtilAnos: z.coerce.number().int().optional(),
  valorResidual: z.coerce.number().optional(),
  observacoes: z.string().optional(),
  fotoUrl: z.string().optional(),
});

export type BemFormValues = z.infer<typeof bemSchema>;

export async function createBem(values: BemFormValues): Promise<Result> {
  const session = await auth();
  const parsed = bemSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  try {
    const codigo = await gerarCodigoBem();
    const d = parsed.data;

    const bem = await prisma.patrimonioBem.create({
      data: {
        codigo,
        nome: d.nome,
        categoria: d.categoria,
        estado: d.estado,
        status: d.status,
        descricao: d.descricao || null,
        marca: d.marca || null,
        modelo: d.modelo || null,
        numeroSerie: d.numeroSerie || null,
        localId: d.localId || null,
        responsavelId: d.responsavelId || null,
        valorAquisicao: d.valorAquisicao ?? null,
        dataAquisicao: d.dataAquisicao ? new Date(d.dataAquisicao) : null,
        notaFiscal: d.notaFiscal || null,
        fornecedor: d.fornecedor || null,
        vidaUtilAnos: d.vidaUtilAnos ?? null,
        valorResidual: d.valorResidual ?? null,
        observacoes: d.observacoes || null,
        fotoUrl: d.fotoUrl || null,
        createdById: session?.user?.id ?? null,
      },
    });

    // Registra movimentação de entrada automática
    await prisma.patrimonioMovimentacao.create({
      data: {
        bemId: bem.id,
        tipo: "entrada",
        data: bem.dataAquisicao ?? new Date(),
        localDestinoId: d.localId || null,
        responsavelId: d.responsavelId || null,
        observacoes: "Cadastro inicial do bem.",
        createdById: session?.user?.id ?? null,
      },
    });

    await recordAudit({
      userId: session?.user?.id,
      action: "CREATE",
      entity: "PatrimonioBem",
      entityId: bem.id,
    });

    revalidatePath("/patrimonio");
    return { ok: true, id: bem.id };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Erro ao cadastrar o bem." };
  }
}

export async function updateBem(id: string, values: BemFormValues): Promise<Result> {
  const session = await auth();
  const parsed = bemSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  try {
    const d = parsed.data;
    await prisma.patrimonioBem.update({
      where: { id },
      data: {
        nome: d.nome,
        categoria: d.categoria,
        estado: d.estado,
        status: d.status,
        descricao: d.descricao || null,
        marca: d.marca || null,
        modelo: d.modelo || null,
        numeroSerie: d.numeroSerie || null,
        localId: d.localId || null,
        responsavelId: d.responsavelId || null,
        valorAquisicao: d.valorAquisicao ?? null,
        dataAquisicao: d.dataAquisicao ? new Date(d.dataAquisicao) : null,
        notaFiscal: d.notaFiscal || null,
        fornecedor: d.fornecedor || null,
        vidaUtilAnos: d.vidaUtilAnos ?? null,
        valorResidual: d.valorResidual ?? null,
        observacoes: d.observacoes || null,
        fotoUrl: d.fotoUrl || null,
        updatedById: session?.user?.id ?? null,
      },
    });

    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "PatrimonioBem",
      entityId: id,
    });

    revalidatePath("/patrimonio");
    revalidatePath(`/patrimonio/${id}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao atualizar o bem." };
  }
}

const movSchema = z.object({
  bemId: z.string(),
  tipo: z.enum(["entrada", "transferencia", "emprestimo", "devolucao", "manutencao", "retorno_manutencao", "baixa"]),
  data: z.string(),
  localOrigemId: z.string().optional(),
  localDestinoId: z.string().optional(),
  responsavelId: z.string().optional(),
  dataDevolucaoPrevista: z.string().optional(),
  observacoes: z.string().optional(),
});

export type MovimentacaoFormValues = z.infer<typeof movSchema>;

export async function registrarMovimentacao(values: MovimentacaoFormValues): Promise<Result> {
  const session = await auth();
  const parsed = movSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const d = parsed.data;

  const bem = await prisma.patrimonioBem.findUnique({ where: { id: d.bemId } });
  if (!bem) return { ok: false, error: "Bem não encontrado." };
  if (bem.status === "baixado") return { ok: false, error: "Bem baixado não pode receber movimentações." };

  if (d.tipo === "emprestimo" && (!d.responsavelId || !d.dataDevolucaoPrevista)) {
    return { ok: false, error: "Empréstimo requer responsável e data prevista de devolução." };
  }

  const statusMap: Partial<Record<MovimentacaoTipo, PatrimonioStatus>> = {
    emprestimo: "emprestado",
    devolucao: "disponivel",
    manutencao: "manutencao",
    retorno_manutencao: "disponivel",
    baixa: "baixado",
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.patrimonioMovimentacao.create({
        data: {
          bemId: d.bemId,
          tipo: d.tipo,
          data: new Date(d.data),
          localOrigemId: d.localOrigemId || null,
          localDestinoId: d.localDestinoId || null,
          responsavelId: d.responsavelId || null,
          dataDevolucaoPrevista: d.dataDevolucaoPrevista ? new Date(d.dataDevolucaoPrevista) : null,
          observacoes: d.observacoes || null,
          createdById: session?.user?.id ?? null,
        },
      });

      const updateData: Record<string, unknown> = {};
      if (statusMap[d.tipo as MovimentacaoTipo]) {
        updateData.status = statusMap[d.tipo as MovimentacaoTipo];
      }
      if (d.tipo === "transferencia" && d.localDestinoId) {
        updateData.localId = d.localDestinoId;
      }
      if (Object.keys(updateData).length > 0) {
        await tx.patrimonioBem.update({ where: { id: d.bemId }, data: updateData });
      }
    });

    revalidatePath("/patrimonio");
    revalidatePath(`/patrimonio/${d.bemId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao registrar movimentação." };
  }
}

export async function baixarBem(id: string, observacoes: string): Promise<Result> {
  const session = await auth();
  try {
    await prisma.$transaction([
      prisma.patrimonioMovimentacao.create({
        data: {
          bemId: id,
          tipo: "baixa",
          data: new Date(),
          observacoes: observacoes || "Bem baixado.",
          createdById: session?.user?.id ?? null,
        },
      }),
      prisma.patrimonioBem.update({
        where: { id },
        data: { status: "baixado", updatedById: session?.user?.id ?? null },
      }),
    ]);

    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "PatrimonioBem",
      entityId: id,
      metadata: { action: "baixa" },
    });

    revalidatePath("/patrimonio");
    revalidatePath(`/patrimonio/${id}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao baixar o bem." };
  }
}

export async function exportarBensCSV(filters: BemFilters): Promise<string> {
  const { bens } = await getBens({ ...filters, page: 1 });
  // Busca todos sem paginação
  const todos = await prisma.patrimonioBem.findMany({
    where: buildWhere(filters),
    include: { local: true, responsavel: { select: { fullName: true } } },
    orderBy: { codigo: "asc" },
  });

  const header = "Código,Nome,Categoria,Estado,Status,Local,Responsável,Valor Aquisição,Data Aquisição\n";
  const rows = todos
    .map((b) =>
      [
        b.codigo,
        `"${b.nome}"`,
        b.categoria,
        b.estado,
        b.status,
        b.local?.nome ?? "",
        b.responsavel?.fullName ?? "",
        b.valorAquisicao ? Number(b.valorAquisicao).toFixed(2) : "",
        b.dataAquisicao ? b.dataAquisicao.toISOString().split("T")[0] : "",
      ].join(","),
    )
    .join("\n");

  return header + rows;
}

function buildWhere(filters: BemFilters): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.categoria) where.categoria = filters.categoria;
  if (filters.status) where.status = filters.status;
  if (filters.localId) where.localId = filters.localId;
  if (filters.search) {
    where.OR = [
      { nome: { contains: filters.search, mode: "insensitive" } },
      { codigo: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return where;
}

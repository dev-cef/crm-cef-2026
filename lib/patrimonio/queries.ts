import { prisma } from "@/lib/prisma";
import type { BemFilters, BemComRelacoes, MovimentacaoComRelacoes, PatrimonioStats } from "./types";

const BEM_SELECT = {
  id: true,
  codigo: true,
  nome: true,
  descricao: true,
  marca: true,
  modelo: true,
  numeroSerie: true,
  categoria: true,
  estado: true,
  status: true,
  valorAquisicao: true,
  dataAquisicao: true,
  notaFiscal: true,
  fornecedor: true,
  vidaUtilAnos: true,
  valorResidual: true,
  observacoes: true,
  fotoUrl: true,
  localId: true,
  responsavelId: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  local: true,
  responsavel: { select: { id: true, fullName: true, email: true } },
} as const;

export async function getBens(
  filters: BemFilters = {},
): Promise<{ bens: BemComRelacoes[]; total: number }> {
  const PAGE_SIZE = 20;
  const page = filters.page ?? 1;
  const skip = (page - 1) * PAGE_SIZE;

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

  const [bens, total] = await Promise.all([
    prisma.patrimonioBem.findMany({
      where,
      include: { local: true, responsavel: { select: { id: true, fullName: true, email: true } } },
      orderBy: { codigo: "asc" },
      take: PAGE_SIZE,
      skip,
    }),
    prisma.patrimonioBem.count({ where }),
  ]);

  return { bens: bens as BemComRelacoes[], total };
}

export async function getBemById(id: string): Promise<BemComRelacoes | null> {
  const bem = await prisma.patrimonioBem.findUnique({
    where: { id },
    include: {
      local: true,
      responsavel: { select: { id: true, fullName: true, email: true } },
      movimentacoes: {
        include: {
          localOrigem: true,
          localDestino: true,
          responsavel: { select: { id: true, fullName: true } },
        },
        orderBy: { data: "desc" },
      },
    },
  });
  return bem as BemComRelacoes | null;
}

export async function getMovimentacoes(bemId: string): Promise<MovimentacaoComRelacoes[]> {
  const rows = await prisma.patrimonioMovimentacao.findMany({
    where: { bemId },
    include: {
      localOrigem: true,
      localDestino: true,
      responsavel: { select: { id: true, fullName: true } },
    },
    orderBy: { data: "desc" },
  });
  return rows as MovimentacaoComRelacoes[];
}

export async function getLocais() {
  return prisma.patrimonioLocal.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
  });
}

export async function getLocaisTodos() {
  return prisma.patrimonioLocal.findMany({ orderBy: { nome: "asc" } });
}

export async function getEmprestimosAtivos() {
  const bens = await prisma.patrimonioBem.findMany({
    where: { status: "emprestado" },
    include: {
      responsavel: { select: { id: true, fullName: true } },
      local: true,
      movimentacoes: {
        where: { tipo: "emprestimo" },
        include: { responsavel: { select: { id: true, fullName: true } } },
        orderBy: { data: "desc" },
        take: 1,
      },
    },
    orderBy: { codigo: "asc" },
  });
  return bens;
}

export async function getMembros() {
  return prisma.member.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true, fullName: true, email: true },
    orderBy: { fullName: "asc" },
  });
}

export async function getResumoStats(): Promise<PatrimonioStats> {
  const bens = await prisma.patrimonioBem.findMany({
    where: { status: { not: "baixado" } },
    select: { status: true, categoria: true, valorAquisicao: true },
  });

  const total = bens.length;
  const valorTotal = bens.reduce(
    (acc, b) => acc + (b.valorAquisicao ? Number(b.valorAquisicao) : 0),
    0,
  );
  const emManutencao = bens.filter((b) => b.status === "manutencao").length;
  const emprestados = bens.filter((b) => b.status === "emprestado").length;

  const porCategoria = { equipamento: 0, movel_utensilio: 0, eletronico: 0 } as Record<string, number>;
  for (const b of bens) {
    if (b.categoria in porCategoria) porCategoria[b.categoria]++;
  }

  return { total, valorTotal, emManutencao, emprestados, porCategoria } as PatrimonioStats;
}

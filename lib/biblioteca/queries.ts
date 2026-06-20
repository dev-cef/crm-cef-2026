import { prisma } from "@/lib/prisma";
import type { LivroFilters } from "./types";

const PAGE_SIZE = 20;

export async function getLivros(filters: LivroFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = {};

  if (filters.search) {
    where.OR = [
      { titulo: { contains: filters.search, mode: "insensitive" } },
      { autor: { contains: filters.search, mode: "insensitive" } },
      { isbn: { contains: filters.search, mode: "insensitive" } },
      { numeroTombo: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.categoriaId) where.categoriaId = filters.categoriaId;
  if (filters.origem) where.origem = filters.origem;
  if (filters.disponivel === "true") where.disponivel = true;
  if (filters.disponivel === "false") where.disponivel = false;

  const [livros, total] = await Promise.all([
    prisma.bibliotecaLivro.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy: { titulo: "asc" },
      include: {
        categoria: true,
        doadorSocio: { select: { id: true, fullName: true } },
        emprestimos: {
          where: { status: { in: ["ativo", "atrasado"] } },
          select: { id: true, status: true, prazoDevolucao: true, retiradoEm: true },
          take: 1,
        },
        reservas: {
          where: { ativa: true },
          select: { id: true, ativa: true, socioId: true },
        },
      },
    }),
    prisma.bibliotecaLivro.count({ where }),
  ]);

  return {
    livros,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export async function getLivroById(id: string) {
  return prisma.bibliotecaLivro.findUnique({
    where: { id },
    include: {
      categoria: true,
      doadorSocio: { select: { id: true, fullName: true } },
      emprestimos: {
        orderBy: { retiradoEm: "desc" },
        take: 20,
        include: {
          socio: { select: { id: true, fullName: true, phone: true } },
        },
      },
      reservas: {
        where: { ativa: true },
        orderBy: { reservadoEm: "asc" },
        include: {
          socio: { select: { id: true, fullName: true } },
        },
      },
    },
  });
}

export async function getEmprestimosAtivos() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Marca atrasados antes de buscar
  await prisma.bibliotecaEmprestimo.updateMany({
    where: { status: "ativo", prazoDevolucao: { lt: today } },
    data: { status: "atrasado" },
  });

  return prisma.bibliotecaEmprestimo.findMany({
    where: { status: { in: ["ativo", "atrasado"] } },
    orderBy: [{ status: "asc" }, { prazoDevolucao: "asc" }],
    include: {
      livro: { select: { id: true, titulo: true, autor: true, numeroTombo: true } },
      socio: { select: { id: true, fullName: true, phone: true } },
    },
  });
}

export async function getHistoricoSocio(socioId: string) {
  return prisma.bibliotecaEmprestimo.findMany({
    where: { socioId },
    orderBy: { retiradoEm: "desc" },
    include: {
      livro: { select: { id: true, titulo: true, autor: true, numeroTombo: true } },
    },
  });
}

export async function getCategorias() {
  return prisma.bibliotecaCategoria.findMany({ orderBy: { nome: "asc" } });
}

export async function getMembrosAtivos() {
  return prisma.member.findMany({
    where: { status: "ATIVO", deletedAt: null },
    select: { id: true, fullName: true, registration: true },
    orderBy: { fullName: "asc" },
  });
}

export async function getStats(): Promise<import("./types").BibliotecaStats> {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);

  const [total, disponiveis, emprestados, atrasados, doacoes, emprestadosEsteMes] =
    await Promise.all([
      prisma.bibliotecaLivro.count(),
      prisma.bibliotecaLivro.count({ where: { disponivel: true } }),
      prisma.bibliotecaEmprestimo.count({ where: { status: "ativo" } }),
      prisma.bibliotecaEmprestimo.count({ where: { status: "atrasado" } }),
      prisma.bibliotecaLivro.count({ where: { origem: "doacao" } }),
      prisma.bibliotecaEmprestimo.count({ where: { retiradoEm: { gte: inicioMes } } }),
    ]);

  return { total, disponiveis, emprestados, atrasados, doacoes, emprestadosEsteMes };
}

export async function gerarNumeroTombo(): Promise<string> {
  const ano = new Date().getFullYear();
  const ultimo = await prisma.bibliotecaLivro.findFirst({
    where: { numeroTombo: { startsWith: `CEF-LIV-${ano}-` } },
    orderBy: { numeroTombo: "desc" },
    select: { numeroTombo: true },
  });
  const seq = ultimo?.numeroTombo
    ? parseInt(ultimo.numeroTombo.split("-").pop() ?? "0") + 1
    : 1;
  return `CEF-LIV-${ano}-${String(seq).padStart(3, "0")}`;
}

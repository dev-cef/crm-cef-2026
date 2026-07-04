import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/rbac";
import type { DocumentoFilters, DocumentosStats } from "./types";

const PAGE_SIZE = 20;

// Escopo por papel: ADMIN vê tudo; DEPARTAMENTO (Diretoria) vê ASSOCIADOS +
// DIRETORIA; ASSOCIADO vê apenas documentos ATIVOS de nível ASSOCIADOS.
export function docScopeWhere(role: Role): Record<string, unknown> {
  if (role === "ADMIN") return {};
  if (role === "DEPARTAMENTO") return { nivelAcesso: { in: ["ASSOCIADOS", "DIRETORIA"] } };
  return { nivelAcesso: "ASSOCIADOS", status: "ATIVO" };
}

export async function getDocumentos(filters: DocumentoFilters, role: Role) {
  const page = Math.max(1, filters.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = { ...docScopeWhere(role) };

  if (filters.search) {
    where.OR = [
      { titulo: { contains: filters.search, mode: "insensitive" } },
      { descricao: { contains: filters.search, mode: "insensitive" } },
      { tags: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.categoriaId) where.categoriaId = filters.categoriaId;
  if (filters.status) where.status = filters.status;
  if (filters.nivelAcesso && role === "ADMIN") where.nivelAcesso = filters.nivelAcesso;
  if (filters.nivelAcesso && role === "DEPARTAMENTO" && filters.nivelAcesso !== "ADMIN") {
    where.nivelAcesso = filters.nivelAcesso;
  }

  const orderBy =
    filters.ordenar === "titulo"
      ? ({ titulo: "asc" } as const)
      : ({ publicadoEm: "desc" } as const);

  const [documentos, total] = await Promise.all([
    prisma.documento.findMany({
      where,
      skip,
      take: PAGE_SIZE,
      orderBy,
      include: { categoria: true },
    }),
    prisma.documento.count({ where }),
  ]);

  return { documentos, total, page, totalPages: Math.ceil(total / PAGE_SIZE) };
}

export async function getDocumentoById(id: string, role: Role) {
  const documento = await prisma.documento.findFirst({
    where: { id, ...docScopeWhere(role) },
    include: {
      categoria: true,
      versoes: { orderBy: { criadoEm: "desc" } },
    },
  });
  if (!documento) return null;

  // Resolve nomes dos responsáveis (IDs planos, sem relação no schema).
  const userIds = [
    documento.criadoPorId,
    documento.atualizadoPorId,
    ...documento.versoes.map((v) => v.criadoPorId),
  ].filter((v): v is string => !!v);

  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name || u.email]));

  return {
    ...documento,
    criadoPorNome: documento.criadoPorId ? userMap.get(documento.criadoPorId) ?? null : null,
    atualizadoPorNome: documento.atualizadoPorId
      ? userMap.get(documento.atualizadoPorId) ?? null
      : null,
    versoes: documento.versoes.map((v) => ({
      ...v,
      criadoPorNome: v.criadoPorId ? userMap.get(v.criadoPorId) ?? null : null,
    })),
  };
}

export async function getDocCategorias() {
  return prisma.documentoCategoria.findMany({
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    include: { _count: { select: { documentos: true } } },
  });
}

export async function getDocStats(role: Role): Promise<DocumentosStats> {
  const scope = docScopeWhere(role);
  const [total, ativos, emRevisao, arquivados, vencidos] = await Promise.all([
    prisma.documento.count({ where: scope }),
    prisma.documento.count({ where: { ...scope, status: "ATIVO" } }),
    prisma.documento.count({ where: { ...scope, status: "EM_REVISAO" } }),
    prisma.documento.count({ where: { ...scope, status: "ARQUIVADO" } }),
    prisma.documento.count({
      where: { ...scope, status: "ATIVO", validadeEm: { lt: new Date() } },
    }),
  ]);
  return { total, ativos, emRevisao, arquivados, vencidos };
}

// Documentos visíveis ao associado no Meu Espaço, agrupados por categoria.
export async function getDocumentosParaAssociado(search?: string) {
  const where: Record<string, unknown> = { nivelAcesso: "ASSOCIADOS", status: "ATIVO" };
  if (search) {
    where.OR = [
      { titulo: { contains: search, mode: "insensitive" } },
      { descricao: { contains: search, mode: "insensitive" } },
      { tags: { contains: search, mode: "insensitive" } },
    ];
  }

  const documentos = await prisma.documento.findMany({
    where,
    orderBy: { publicadoEm: "desc" },
    include: { categoria: true },
  });

  const grupos = new Map<string, { categoria: string; docs: typeof documentos }>();
  for (const doc of documentos) {
    const key = doc.categoria?.nome ?? "Outros";
    if (!grupos.has(key)) grupos.set(key, { categoria: key, docs: [] });
    grupos.get(key)!.docs.push(doc);
  }

  return [...grupos.values()].sort((a, b) =>
    a.categoria.localeCompare(b.categoria, "pt-BR"),
  );
}

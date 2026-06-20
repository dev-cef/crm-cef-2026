import type { BibliotecaLivro, BibliotecaCategoria, BibliotecaEmprestimo, BibliotecaReserva, Member } from "@/app/generated/prisma/client";

export type LivroOrigem = "proprio" | "doacao";
export type LivroEstado = "otimo" | "bom" | "regular" | "danificado" | "perdido";
export type EmprestimoStatus = "ativo" | "devolvido" | "atrasado" | "extraviado";

export type LivroComRelacoes = BibliotecaLivro & {
  categoria: BibliotecaCategoria | null;
  doadorSocio: Pick<Member, "id" | "fullName"> | null;
  emprestimos: Pick<BibliotecaEmprestimo, "id" | "status" | "prazoDevolucao" | "retiradoEm">[];
  reservas: Pick<BibliotecaReserva, "id" | "ativa" | "socioId">[];
};

export type EmprestimoComRelacoes = BibliotecaEmprestimo & {
  livro: Pick<BibliotecaLivro, "id" | "titulo" | "autor" | "numeroTombo">;
  socio: Pick<Member, "id" | "fullName" | "phone">;
};

export type BibliotecaStats = {
  total: number;
  disponiveis: number;
  emprestados: number;
  atrasados: number;
  doacoes: number;
  emprestadosEsteMes: number;
};

export type LivroFilters = {
  search?: string;
  categoriaId?: string;
  origem?: string;
  disponivel?: string; // "true" | "false" | ""
  page?: number;
};

export const ESTADO_LABELS: Record<LivroEstado, string> = {
  otimo: "Ótimo",
  bom: "Bom",
  regular: "Regular",
  danificado: "Danificado",
  perdido: "Perdido",
};

export const ORIGEM_LABELS: Record<LivroOrigem, string> = {
  proprio: "Próprio",
  doacao: "Doação",
};

export const EMPRESTIMO_STATUS_LABELS: Record<EmprestimoStatus, string> = {
  ativo: "Ativo",
  devolvido: "Devolvido",
  atrasado: "Atrasado",
  extraviado: "Extraviado",
};

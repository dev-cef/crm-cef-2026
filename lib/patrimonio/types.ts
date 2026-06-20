import type { PatrimonioBem, PatrimonioLocal, PatrimonioMovimentacao, Member } from "@/app/generated/prisma/client";

export type { PatrimonioBem, PatrimonioLocal, PatrimonioMovimentacao };

export type PatrimonioCategoria = "equipamento" | "movel_utensilio" | "eletronico";
export type PatrimonioEstado = "otimo" | "bom" | "regular" | "danificado" | "descartado";
export type PatrimonioStatus = "disponivel" | "em_uso" | "manutencao" | "emprestado" | "baixado";
export type MovimentacaoTipo =
  | "entrada"
  | "transferencia"
  | "emprestimo"
  | "devolucao"
  | "manutencao"
  | "retorno_manutencao"
  | "baixa";

export type BemComRelacoes = PatrimonioBem & {
  local: PatrimonioLocal | null;
  responsavel: Pick<Member, "id" | "fullName" | "email"> | null;
  movimentacoes?: MovimentacaoComRelacoes[];
};

export type MovimentacaoComRelacoes = PatrimonioMovimentacao & {
  localOrigem: PatrimonioLocal | null;
  localDestino: PatrimonioLocal | null;
  responsavel: Pick<Member, "id" | "fullName"> | null;
};

export type PatrimonioStats = {
  total: number;
  valorTotal: number;
  emManutencao: number;
  emprestados: number;
  porCategoria: Record<PatrimonioCategoria, number>;
};

export type BemFilters = {
  search?: string;
  categoria?: PatrimonioCategoria | "";
  status?: PatrimonioStatus | "";
  localId?: string;
  page?: number;
};

export const CATEGORIA_LABELS: Record<PatrimonioCategoria, string> = {
  equipamento: "Equipamento",
  movel_utensilio: "Móvel / Utensílio",
  eletronico: "Eletrônico",
};

export const ESTADO_LABELS: Record<PatrimonioEstado, string> = {
  otimo: "Ótimo",
  bom: "Bom",
  regular: "Regular",
  danificado: "Danificado",
  descartado: "Descartado",
};

export const STATUS_LABELS: Record<PatrimonioStatus, string> = {
  disponivel: "Disponível",
  em_uso: "Em uso",
  manutencao: "Manutenção",
  emprestado: "Emprestado",
  baixado: "Baixado",
};

export const MOVIMENTACAO_LABELS: Record<MovimentacaoTipo, string> = {
  entrada: "Entrada",
  transferencia: "Transferência",
  emprestimo: "Empréstimo",
  devolucao: "Devolução",
  manutencao: "Envio para manutenção",
  retorno_manutencao: "Retorno de manutenção",
  baixa: "Baixa / Descarte",
};

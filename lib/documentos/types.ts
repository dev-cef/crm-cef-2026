// Constantes e tipos do Módulo de Documentos.
// Arquivos ficam no Google Drive institucional — o CRM só gerencia links/metadados.

export const DOC_STATUS = ["ATIVO", "ARQUIVADO", "EM_REVISAO"] as const;
export type DocStatus = (typeof DOC_STATUS)[number];

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  ATIVO: "Ativo",
  ARQUIVADO: "Arquivado",
  EM_REVISAO: "Em Revisão",
};

export const DOC_NIVEIS = ["ASSOCIADOS", "DIRETORIA", "ADMIN"] as const;
export type DocNivelAcesso = (typeof DOC_NIVEIS)[number];

export const DOC_NIVEL_LABELS: Record<DocNivelAcesso, string> = {
  ASSOCIADOS: "Associados",
  DIRETORIA: "Diretoria",
  ADMIN: "Administradores",
};

export const DOC_NIVEL_DESCRICOES: Record<DocNivelAcesso, string> = {
  ASSOCIADOS: "Visível a todos os associados no Meu Espaço",
  DIRETORIA: "Restrito à Diretoria e usuários autorizados",
  ADMIN: "Confidencial — somente administradores",
};

// Categorias sugeridas — criadas pelo seed; o admin pode adicionar outras.
export const DOC_CATEGORIAS_PADRAO = [
  "Estatuto",
  "Regimento Interno",
  "Regras do Grupo",
  "Boas Práticas",
  "Editais de Convocação",
  "Código de Ética",
  "Atas",
  "Plano de Manejo",
  "Políticas",
  "Manuais",
  "Comunicados",
  "Outros",
] as const;

export interface DocumentoFilters {
  search?: string;
  categoriaId?: string;
  status?: string;
  nivelAcesso?: string;
  ordenar?: string; // "recentes" (padrão) | "titulo"
  page?: number;
}

export interface DocumentosStats {
  total: number;
  ativos: number;
  emRevisao: number;
  arquivados: number;
  vencidos: number;
}

export function parseTags(tags: string): string[] {
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

// ── Google Drive ──────────────────────────────────────────────────────────────

// Extrai o fileId de links comuns do Drive (file/d/, open?id=, uc?id=, docs).
export function driveFileId(url: string): string | null {
  const patterns = [
    /\/(?:file|document|spreadsheets|presentation)\/d\/([\w-]{20,})/,
    /[?&]id=([\w-]{20,})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Link de download direto quando o fileId é identificável; senão o próprio link.
export function driveDownloadUrl(url: string): string {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : url;
}

export function isValidDriveUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname === "drive.google.com" ||
        u.hostname === "docs.google.com" ||
        u.hostname.endsWith(".google.com"))
    );
  } catch {
    return false;
  }
}

// Constantes do upload de documentos pro Drive — client-safe (sem Prisma),
// compartilhadas entre o uploader (browser) e a validação do servidor
// (lib/google-drive.ts reexporta pra rota de upload).

// Tipos aceitos: PDF, Office, LibreOffice e imagens.
export const DRIVE_ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const DRIVE_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

// Atributo accept do <input type="file"> — espelho do DRIVE_ALLOWED_MIME.
export const DRIVE_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.jpg,.jpeg,.png,.webp";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

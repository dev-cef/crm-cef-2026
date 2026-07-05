import { put } from "@vercel/blob";
import crypto from "crypto";

// Armazenamento de imagens em Vercel Blob, com fallback gracioso: enquanto
// BLOB_READ_WRITE_TOKEN não estiver configurado, mantém o base64 no banco
// (comportamento atual). Assim o código pode subir antes do provisionamento;
// quando o token existir, novos uploads passam a ir para o Blob.

export function blobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

// Extensão de arquivo a partir do MIME de um data URI de imagem.
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export type ParsedDataUrl = { contentType: string; ext: string; buffer: Buffer };

// Faz o parse de um data URI base64 ("data:image/png;base64,....").
// Retorna null se não for um data URI de imagem base64 válido.
export function parseImageDataUrl(value: string): ParsedDataUrl | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(value);
  if (!m) return null;
  const contentType = m[1].toLowerCase();
  const ext = MIME_EXT[contentType];
  if (!ext) return null;
  try {
    const buffer = Buffer.from(m[2], "base64");
    if (buffer.length === 0) return null;
    return { contentType, ext, buffer };
  } catch {
    return null;
  }
}

// True quando o valor deve ser enviado ao Blob: é um data URI de imagem.
// URLs http(s) (Blob já existente ou capa externa) e vazios passam direto.
export function shouldUploadToBlob(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith("data:image/");
}

// Persiste um valor de imagem. Se for data URI e o Blob estiver configurado,
// faz upload e devolve a URL pública. Caso contrário devolve o valor como está
// (URL já existente, capa externa, ou base64 no modo fallback).
export async function persistImage(
  value: string | null | undefined,
  prefix: string,
): Promise<string | null> {
  if (!value) return null;
  if (!shouldUploadToBlob(value)) return value; // já é URL ou vazio
  if (!blobConfigured()) return value; // sem Blob: mantém base64 (fallback)

  const parsed = parseImageDataUrl(value);
  if (!parsed) return value; // data URI malformado: não quebra, mantém original

  const { url } = await put(
    `${prefix}/${crypto.randomUUID()}.${parsed.ext}`,
    parsed.buffer,
    { access: "public", contentType: parsed.contentType },
  );
  return url;
}

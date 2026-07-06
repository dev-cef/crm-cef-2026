import { put, get, del } from "@vercel/blob";
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

// Comprovantes vivem num store Vercel Blob separado e privado
// ("cef-comprovantes"), distinto do store público de fotos — por isso usam
// seu próprio token em vez do BLOB_READ_WRITE_TOKEN default do SDK.
export function comprovanteBlobConfigured(): boolean {
  return !!process.env.BLOB_COMPROVANTES_READ_WRITE_TOKEN;
}

// Extensão de arquivo a partir do MIME de um data URI de comprovante
// (imagem ou PDF). Comprovantes financeiros aceitam PDF; fotos não.
const COMPROVANTE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

// Faz o parse de um data URI base64 de comprovante (imagem ou PDF).
// Retorna null se não for um data URI válido de um MIME aceito.
export function parseComprovanteDataUrl(value: string): ParsedDataUrl | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+|application\/pdf);base64,([\s\S]+)$/.exec(value);
  if (!m) return null;
  const contentType = m[1].toLowerCase();
  const ext = COMPROVANTE_MIME_EXT[contentType];
  if (!ext) return null;
  try {
    const buffer = Buffer.from(m[2], "base64");
    if (buffer.length === 0) return null;
    return { contentType, ext, buffer };
  } catch {
    return null;
  }
}

// True quando o valor deve ser enviado ao Blob: é um data URI de imagem ou PDF.
export function shouldUploadComprovanteToBlob(value: string | null | undefined): value is string {
  return typeof value === "string" && (value.startsWith("data:image/") || value.startsWith("data:application/pdf"));
}

// Persiste um comprovante (imagem ou PDF) em Blob privado. Se for data URI e
// o Blob estiver configurado, faz upload e devolve o *pathname* (não a URL —
// Blob privado não expõe URL pública estável; a leitura exige o token, feita
// via getComprovanteBytes). Caso contrário devolve o valor como está (pathname
// já existente, ou base64 no modo fallback sem Blob configurado).
export async function persistComprovante(
  value: string | null | undefined,
  prefix: string,
): Promise<string | null> {
  if (!value) return null;
  if (!shouldUploadComprovanteToBlob(value)) return value; // já é pathname ou vazio
  if (!comprovanteBlobConfigured()) return value; // sem Blob: mantém base64 (fallback)

  const parsed = parseComprovanteDataUrl(value);
  if (!parsed) return value; // data URI malformado ou MIME não aceito: mantém original

  const { pathname } = await put(
    `${prefix}/${crypto.randomUUID()}.${parsed.ext}`,
    parsed.buffer,
    {
      access: "private",
      contentType: parsed.contentType,
      token: process.env.BLOB_COMPROVANTES_READ_WRITE_TOKEN,
    },
  );
  return pathname;
}

// Busca os bytes de um comprovante já migrado para Blob privado. Retorna null
// se não configurado ou não encontrado — quem chama deve tratar o fallback
// (valor ainda em base64 no banco) separadamente.
export async function getComprovanteBytes(
  pathname: string,
): Promise<{ body: Buffer; contentType: string } | null> {
  if (!comprovanteBlobConfigured()) return null;
  const result = await get(pathname, {
    access: "private",
    token: process.env.BLOB_COMPROVANTES_READ_WRITE_TOKEN,
  });
  if (!result || !result.stream) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of result.stream as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return { body: Buffer.concat(chunks), contentType: result.blob.contentType };
}

// Remove um comprovante do Blob. Não lançamos erro — nenhum fluxo ativo
// depende disso hoje (ver decisão de deixar órfão em vez de apagar), mas fica
// disponível para uma futura rotina de limpeza administrativa.
export async function deleteComprovante(pathname: string): Promise<void> {
  if (!comprovanteBlobConfigured()) return;
  try {
    await del(pathname, { token: process.env.BLOB_COMPROVANTES_READ_WRITE_TOKEN });
  } catch (err) {
    console.error("deleteComprovante: falha ao apagar do Blob", pathname, err);
  }
}

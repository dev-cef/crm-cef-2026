// Integração com o Google Drive do CEF para upload de documentos.
//
// Fluxo: o admin conecta o Drive uma única vez via OAuth (escopo drive.file —
// o app só enxerga arquivos que ele mesmo criou). O refresh token fica no
// SystemConfig e é trocado por access tokens sob demanda. O upload do arquivo
// vai DIRETO do navegador pro Google (sessão resumable criada no servidor),
// contornando o limite de body do Vercel — só metadados passam por aqui.
//
// Reutiliza o OAuth client do login (AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET). O
// redirect URI /api/google-drive/callback precisa estar cadastrado no client
// no Google Cloud Console.

import { prisma } from "@/lib/prisma";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const DRIVE_FOLDER_NAME = "CRM CEF — Documentos";

// Tipos aceitos no upload de documentos (PDF, Office, LibreOffice, imagens).
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

export function driveOauthConfigured(): boolean {
  return !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;
}

export async function getDriveConfig() {
  let cfg = await prisma.systemConfig.findFirst();
  if (!cfg) cfg = await prisma.systemConfig.create({ data: {} });
  return cfg;
}

export async function driveConnected(): Promise<boolean> {
  const cfg = await getDriveConfig();
  return !!cfg.driveRefreshToken && !!cfg.driveFolderId;
}

// ── OAuth ────────────────────────────────────────────────────────────────────

export function driveAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: `${DRIVE_SCOPE} email`,
    access_type: "offline",
    prompt: "consent", // força emitir refresh_token mesmo em reconexão
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`token exchange falhou: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in: number;
  };
}

// Access token a partir do refresh token guardado. Lança se não conectado.
export async function getDriveAccessToken(): Promise<string> {
  const cfg = await getDriveConfig();
  if (!cfg.driveRefreshToken) throw new Error("Google Drive não conectado.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: cfg.driveRefreshToken,
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    // Token revogado/expirado → desconecta pra UI oferecer reconexão.
    if (res.status === 400 || res.status === 401) {
      await prisma.systemConfig.update({
        where: { id: cfg.id },
        data: { driveRefreshToken: null, driveConnectedAt: null },
      });
    }
    throw new Error(`refresh do access token falhou: ${res.status}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

// e-mail da conta a partir do id_token (JWT do Google — payload é público).
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

// ── Drive API ────────────────────────────────────────────────────────────────

// Cria (ou reusa) a pasta do CRM no Drive do clube. Retorna o folderId.
export async function ensureDriveFolder(accessToken: string): Promise<string> {
  // Com escopo drive.file, a busca só enxerga o que o app criou — se a pasta
  // já existe de uma conexão anterior, reusa.
  const q = encodeURIComponent(
    `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const found = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (found.ok) {
    const json = (await found.json()) as { files?: { id: string }[] };
    if (json.files?.[0]?.id) return json.files[0].id;
  }

  const created = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!created.ok) throw new Error(`criação da pasta falhou: ${created.status}`);
  return ((await created.json()) as { id: string }).id;
}

// Sessão de upload resumable. O navegador faz PUT do arquivo direto na URL
// retornada (o Google libera CORS pro Origin informado aqui).
export async function createResumableSession(params: {
  name: string;
  mimeType: string;
  size: number;
  origin: string;
}): Promise<string> {
  const accessToken = await getDriveAccessToken();
  const cfg = await getDriveConfig();
  if (!cfg.driveFolderId) throw new Error("Pasta do Drive não configurada.");

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": params.mimeType,
        "X-Upload-Content-Length": String(params.size),
        Origin: params.origin,
      },
      body: JSON.stringify({ name: params.name, parents: [cfg.driveFolderId] }),
    },
  );
  if (!res.ok) throw new Error(`sessão de upload falhou: ${res.status} ${await res.text()}`);
  const location = res.headers.get("location");
  if (!location) throw new Error("Google não retornou a URL da sessão de upload.");
  return location;
}

// Confirma um arquivo recém-enviado: verifica que existe (o token drive.file só
// acessa arquivos do próprio app), libera leitura por link e retorna o link.
export async function finalizeUploadedFile(fileId: string): Promise<{
  webViewLink: string;
  name: string;
  mimeType: string;
  size: number | null;
}> {
  const accessToken = await getDriveAccessToken();

  const meta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,webViewLink`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!meta.ok) throw new Error(`arquivo não encontrado no Drive: ${meta.status}`);
  const file = (await meta.json()) as {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    webViewLink?: string;
  };

  // Qualquer pessoa com o link pode ver — o CRM controla quem recebe o link
  // (mesmo modelo dos links colados manualmente).
  const perm = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    },
  );
  if (!perm.ok) throw new Error(`liberação de leitura falhou: ${perm.status}`);

  return {
    webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size ? Number(file.size) : null,
  };
}

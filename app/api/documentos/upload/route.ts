// Upload de documento pro Google Drive do CEF em duas fases (só metadados
// passam pelo Vercel — o arquivo vai direto do navegador pro Google):
//
//   POST { phase: "start", name, mimeType, size } → { uploadUrl }
//     cria a sessão resumable; o cliente faz PUT do arquivo na uploadUrl.
//   POST { phase: "finish", fileId } → { driveUrl }
//     confirma o arquivo, libera leitura por link e devolve o link pro form.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import {
  createResumableSession,
  finalizeUploadedFile,
  driveConnected,
  DRIVE_ALLOWED_MIME,
  DRIVE_MAX_BYTES,
} from "@/lib/google-drive";

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = toSessionUser(session?.user ?? {});
  if (!session?.user?.id || !(await can(user, "documentos", "create"))) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  if (!(await driveConnected())) {
    return NextResponse.json(
      { error: "O Google Drive do CEF ainda não foi conectado. Peça a um administrador." },
      { status: 409 },
    );
  }

  let body: {
    phase?: string;
    name?: string;
    mimeType?: string;
    size?: number;
    fileId?: string;
    categoria?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  try {
    if (body.phase === "start") {
      const name = (body.name ?? "").trim().slice(0, 200);
      const mimeType = body.mimeType ?? "";
      const size = Number(body.size ?? 0);
      if (!name) return NextResponse.json({ error: "Nome do arquivo obrigatório." }, { status: 400 });
      if (!DRIVE_ALLOWED_MIME.has(mimeType)) {
        return NextResponse.json(
          { error: "Tipo de arquivo não permitido (use PDF, Office ou imagem)." },
          { status: 400 },
        );
      }
      if (!Number.isFinite(size) || size <= 0 || size > DRIVE_MAX_BYTES) {
        return NextResponse.json({ error: "Arquivo vazio ou acima de 100 MB." }, { status: 400 });
      }
      const uploadUrl = await createResumableSession({
        name,
        mimeType,
        size,
        origin: req.nextUrl.origin,
        categoryName: (body.categoria ?? "").trim().slice(0, 100) || "Outros",
      });
      return NextResponse.json({ uploadUrl });
    }

    if (body.phase === "finish") {
      const fileId = (body.fileId ?? "").trim();
      // fileIds do Drive são [\w-]; valida antes de interpolar na URL da API.
      if (!/^[\w-]{10,}$/.test(fileId)) {
        return NextResponse.json({ error: "fileId inválido." }, { status: 400 });
      }
      const file = await finalizeUploadedFile(fileId);
      await recordAudit({
        userId: session.user.id,
        action: "CREATE",
        entity: "DriveUpload",
        entityId: fileId,
        metadata: { name: file.name, mimeType: file.mimeType, size: file.size },
      });
      return NextResponse.json({ driveUrl: file.webViewLink, name: file.name, fileId });
    }

    return NextResponse.json({ error: "phase inválida." }, { status: 400 });
  } catch (err) {
    console.error("[documentos/upload] falha:", err);
    return NextResponse.json(
      { error: "Falha na comunicação com o Google Drive. Tente novamente." },
      { status: 502 },
    );
  }
}

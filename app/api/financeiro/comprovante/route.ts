// Proxy autenticado pra ler comprovantes (imagem/PDF) guardados no Vercel
// Blob privado. Trata também o caso de linhas ainda não migradas (o campo
// segue com o data URI base64 completo) servindo o conteúdo direto.
//
//   GET /api/financeiro/comprovante?kind=payment|whatsapp|transaction&id=...

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getComprovanteBytes } from "@/lib/blob";

type Kind = "payment" | "whatsapp" | "transaction";

async function loadFieldValue(kind: Kind, id: string): Promise<string | null> {
  if (kind === "payment") {
    const row = await prisma.payment.findUnique({ where: { id }, select: { receiptPath: true } });
    return row?.receiptPath ?? null;
  }
  if (kind === "whatsapp") {
    const row = await prisma.whatsappComprovante.findUnique({ where: { id }, select: { imageDataUri: true } });
    return row?.imageDataUri ?? null;
  }
  const row = await prisma.transaction.findUnique({ where: { id }, select: { attachmentUrl: true } });
  return row?.attachmentUrl ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = toSessionUser(session?.user ?? {});
  if (!session?.user?.id || !(await can(user, "financeiro", "view"))) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") as Kind | null;
  const id = searchParams.get("id");
  const download = searchParams.get("download") === "1";
  if (!kind || !["payment", "whatsapp", "transaction"].includes(kind) || !id) {
    return NextResponse.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const value = await loadFieldValue(kind, id);
  if (!value) {
    return NextResponse.json({ error: "Comprovante não encontrado." }, { status: 404 });
  }

  // Fallback: linha ainda não migrada (ou Blob nunca configurado) — o valor
  // é o próprio data URI base64, servimos direto.
  if (value.startsWith("data:")) {
    const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(value);
    if (!match) {
      return NextResponse.json({ error: "Comprovante inválido." }, { status: 500 });
    }
    const contentType = match[1];
    const body = Buffer.from(match[2], "base64");
    const ext = contentType === "application/pdf" ? "pdf" : contentType.split("/")[1] ?? "bin";
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        ...(download ? { "Content-Disposition": `attachment; filename="comprovante-${id}.${ext}"` } : {}),
      },
    });
  }

  const blob = await getComprovanteBytes(value);
  if (!blob) {
    return NextResponse.json({ error: "Comprovante não encontrado no armazenamento." }, { status: 404 });
  }
  const ext = blob.contentType === "application/pdf" ? "pdf" : blob.contentType.split("/")[1] ?? "bin";
  return new NextResponse(new Uint8Array(blob.body), {
    headers: {
      "Content-Type": blob.contentType,
      "Cache-Control": "private, no-store",
      ...(download ? { "Content-Disposition": `attachment; filename="comprovante-${id}.${ext}"` } : {}),
    },
  });
}

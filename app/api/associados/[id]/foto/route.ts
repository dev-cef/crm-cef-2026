// Download da foto original do associado (para produção de carteirinha física).
// A foto já vive em Blob público (lib/blob.ts persistImage), então aqui só
// buscamos os bytes (ou decodificamos o data URI, no fallback sem Blob
// configurado) e devolvemos com Content-Disposition: attachment.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { parseImageDataUrl } from "@/lib/blob";

function filenameSlug(fullName: string): string {
  return (
    fullName
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "associado"
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRole("DEPARTAMENTO");

  const { id } = await params;
  const member = await prisma.member.findFirst({
    where: { id, deletedAt: null },
    select: { fullName: true, photoUrl: true },
  });
  if (!member?.photoUrl) {
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  }

  const filename = filenameSlug(member.fullName);

  const parsed = parseImageDataUrl(member.photoUrl);
  if (parsed) {
    return new NextResponse(new Uint8Array(parsed.buffer), {
      headers: {
        "Content-Type": parsed.contentType,
        "Content-Disposition": `attachment; filename="${filename}.${parsed.ext}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const upstream = await fetch(member.photoUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Erro ao buscar a foto." }, { status: 502 });
  }
  const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
  const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}.${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

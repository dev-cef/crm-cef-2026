// Inicia a conexão OAuth com o Google Drive do CEF (admin-only).
// Redireciona pro consentimento do Google com state assinado (anti-CSRF).

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { driveAuthUrl, driveOauthConfigured } from "@/lib/google-drive";

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = toSessionUser(session?.user ?? {});
  if (!session?.user?.id || user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/documentos", req.nextUrl.origin));
  }
  if (!driveOauthConfigured()) {
    return NextResponse.redirect(
      new URL("/documentos?drive=erro_oauth_nao_configurado", req.nextUrl.origin),
    );
  }

  const redirectUri = `${req.nextUrl.origin}/api/google-drive/callback`;
  const state = jwt.sign({ uid: session.user.id, purpose: "drive-connect" }, process.env.AUTH_SECRET!, {
    expiresIn: "10m",
  });
  return NextResponse.redirect(driveAuthUrl(redirectUri, state));
}

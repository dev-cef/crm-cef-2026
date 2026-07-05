// Callback do OAuth do Google Drive: valida o state, troca o code por tokens,
// garante a pasta do CRM no Drive e persiste tudo no SystemConfig.

import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import {
  exchangeCodeForTokens,
  ensureDriveFolder,
  emailFromIdToken,
  getDriveConfig,
} from "@/lib/google-drive";

export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/documentos?drive=${q}`, req.nextUrl.origin));

  const session = await auth();
  const user = toSessionUser(session?.user ?? {});
  if (!session?.user?.id || user.role !== "ADMIN") return back("erro_permissao");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) return back("erro_cancelado");

  try {
    const payload = jwt.verify(state, process.env.AUTH_SECRET!) as { uid?: string; purpose?: string };
    if (payload.purpose !== "drive-connect" || payload.uid !== session.user.id) {
      return back("erro_state");
    }
  } catch {
    return back("erro_state");
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/google-drive/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) return back("erro_sem_refresh_token");

    const folderId = await ensureDriveFolder(tokens.access_token);
    const cfg = await getDriveConfig();
    await prisma.systemConfig.update({
      where: { id: cfg.id },
      data: {
        driveRefreshToken: tokens.refresh_token,
        driveFolderId: folderId,
        driveAccountEmail: emailFromIdToken(tokens.id_token),
        driveConnectedAt: new Date(),
      },
    });
    await recordAudit({
      userId: session.user.id,
      action: "UPDATE",
      entity: "SystemConfig",
      entityId: cfg.id,
      metadata: { field: "googleDrive", event: "connected" },
    });
    return back("conectado");
  } catch (err) {
    console.error("[google-drive] callback falhou:", err);
    return back("erro_conexao");
  }
}

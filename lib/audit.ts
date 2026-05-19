import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "EXPORT"
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOCKOUT"
  | "LOGIN_OFFHOURS";

// IP/user-agent da requisição (LGPD). Seguro fora de escopo de request.
async function requestMeta(): Promise<{
  ip: string | null;
  userAgent: string | null;
}> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const ip =
      (fwd ? fwd.split(",")[0]!.trim() : null) ?? h.get("x-real-ip") ?? null;
    return { ip, userAgent: h.get("user-agent") };
  } catch {
    return { ip: null, userAgent: null };
  }
}

// Horário comercial em Brasília (06h–22h). Fora disso = acesso fora de hora.
export function isOffHours(date = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hour12: false,
    }).format(date),
  );
  return hour < 6 || hour >= 22;
}

export async function recordAudit(params: {
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    const meta =
      params.ip !== undefined || params.userAgent !== undefined
        ? { ip: params.ip ?? null, userAgent: params.userAgent ?? null }
        : await requestMeta();
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
  } catch (err) {
    console.error("Falha ao registrar auditoria:", err);
  }
}

// Evento de segurança/autenticação (sem entidade de domínio).
export async function recordSecurityEvent(params: {
  userId?: string | null;
  action: Extract<
    AuditAction,
    "LOGIN_SUCCESS" | "LOGIN_FAILED" | "LOCKOUT" | "LOGIN_OFFHOURS"
  >;
  email?: string;
  metadata?: Record<string, unknown>;
}) {
  await recordAudit({
    userId: params.userId ?? null,
    action: params.action,
    entity: "Auth",
    entityId: params.userId ?? params.email ?? "unknown",
    metadata: { email: params.email, ...params.metadata },
  });
}

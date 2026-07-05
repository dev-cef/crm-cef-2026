import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

// Rate limiting fixed-window respaldado no Postgres (Neon) — sem dependência
// externa. Complementa o lockout por conta do login (lib/auth.ts), protegendo
// contra password spraying e abuso de endpoints públicos por IP.

export type RateLimitConfig = { limit: number; windowMs: number };

export type RateDecision = {
  allowed: boolean;
  // Novo valor da contagem quando permitido; irrelevante quando negado.
  nextCount: number;
  // true quando a janela expirou e deve ser reiniciada.
  resetWindow: boolean;
  // Milissegundos até a janela liberar (só quando negado).
  retryAfterMs: number;
};

// Lógica pura de decisão — sem I/O, para ser testável isoladamente.
export function decideRateLimit(
  record: { count: number; windowStart: number } | null,
  now: number,
  { limit, windowMs }: RateLimitConfig,
): RateDecision {
  if (!record || now - record.windowStart >= windowMs) {
    return { allowed: true, nextCount: 1, resetWindow: true, retryAfterMs: 0 };
  }
  if (record.count >= limit) {
    return {
      allowed: false,
      nextCount: record.count,
      resetWindow: false,
      retryAfterMs: windowMs - (now - record.windowStart),
    };
  }
  return { allowed: true, nextCount: record.count + 1, resetWindow: false, retryAfterMs: 0 };
}

export type RateLimitResult = { allowed: boolean; retryAfterMs: number };

// Aplica o limite para `key`. Fail-open: se o banco falhar, permite (prioriza
// disponibilidade do login sobre rigor do limitador) — mas registra no console.
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.rateLimit.findUnique({ where: { key } });
      const decision = decideRateLimit(
        existing ? { count: existing.count, windowStart: existing.windowStart.getTime() } : null,
        now,
        config,
      );

      if (!decision.allowed) {
        return { allowed: false, retryAfterMs: decision.retryAfterMs };
      }

      if (decision.resetWindow) {
        await tx.rateLimit.upsert({
          where: { key },
          create: { key, count: 1, windowStart: new Date(now) },
          update: { count: 1, windowStart: new Date(now) },
        });
      } else {
        await tx.rateLimit.update({
          where: { key },
          data: { count: decision.nextCount },
        });
      }
      return { allowed: true, retryAfterMs: 0 };
    });
  } catch (err) {
    console.error("[rate-limit] erro no store, liberando (fail-open):", err);
    return { allowed: true, retryAfterMs: 0 };
  }
}

// IP do cliente a partir dos headers de proxy (Vercel). "unknown" como fallback
// mantém um balde compartilhado em vez de deixar passar sem limite.
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

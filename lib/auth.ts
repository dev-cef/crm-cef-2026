import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { normalizeRecoveryCode, verifyTotp } from "@/lib/totp";
import { isOffHours, recordSecurityEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeRole, SESSION_MAX_AGE_SECONDS, type Impersonator } from "@/lib/rbac";

const MAX_FAILED_ATTEMPTS = 5;
const BASE_LOCKOUT_MINUTES = 15;
const MAX_LOCKOUT_MINUTES = 24 * 60; // teto do backoff

// Backoff exponencial: 15min, 30, 60, ... limitado a 24h.
function lockoutDurationMs(lockoutCount: number): number {
  const minutes = Math.min(
    BASE_LOCKOUT_MINUTES * 2 ** lockoutCount,
    MAX_LOCKOUT_MINUTES,
  );
  return minutes * 60 * 1000;
}

// Erros tipados: senha OK mas falta/erra o 2FA. Não criam sessão e não
// contam como falha de senha (não mexem no lockout).
export class TwoFactorRequiredError extends CredentialsSignin {
  code = "2fa_required";
}
export class TwoFactorInvalidError extends CredentialsSignin {
  code = "2fa_invalid";
}
// Conta de auto-cadastro ainda não aprovada pelo admin.
export class AccountPendingError extends CredentialsSignin {
  code = "account_pending";
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        token: { label: "Código 2FA", type: "text" },
      },

      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Rate limit por IP: complementa o lockout por conta, freando password
        // spraying (muitas contas diferentes a partir de um mesmo IP).
        const ip =
          request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request?.headers?.get("x-real-ip")?.trim() ||
          "unknown";
        const rl = await checkRateLimit(`login:ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });
        if (!rl.allowed) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          include: {
            member: { select: { id: true } },
            departments: { select: { departmentId: true } },
          },
        });
        if (!user) return null;

        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          if (attempts >= MAX_FAILED_ATTEMPTS) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: 0,
                lockoutCount: user.lockoutCount + 1,
                lockedUntil: new Date(
                  Date.now() + lockoutDurationMs(user.lockoutCount),
                ),
              },
            });
            await recordSecurityEvent({
              userId: user.id,
              action: "LOCKOUT",
              email: user.email,
              metadata: { lockoutCount: user.lockoutCount + 1 },
            });
          } else {
            await prisma.user.update({
              where: { id: user.id },
              data: { failedLoginAttempts: attempts },
            });
          }
          await recordSecurityEvent({
            userId: user.id,
            action: "LOGIN_FAILED",
            email: user.email,
            metadata: { attempts },
          });
          return null;
        }

        // Conta de auto-cadastro aguardando aprovação do admin.
        if (!user.approved) throw new AccountPendingError();

        // Senha OK — segundo fator quando habilitado.
        if (user.totpEnabled && user.totpSecret) {
          const token = String(
            (credentials as { token?: unknown }).token ?? "",
          ).trim();
          if (!token) throw new TwoFactorRequiredError();

          let pass = verifyTotp(user.totpSecret, token);

          if (!pass) {
            const hashes: string[] = JSON.parse(user.totpRecoveryCodes || "[]");
            const norm = normalizeRecoveryCode(token);
            for (let i = 0; i < hashes.length; i++) {
              if (await bcrypt.compare(norm, hashes[i])) {
                hashes.splice(i, 1); // consome o código de recuperação
                await prisma.user.update({
                  where: { id: user.id },
                  data: { totpRecoveryCodes: JSON.stringify(hashes) },
                });
                pass = true;
                break;
              }
            }
          }

          if (!pass) throw new TwoFactorInvalidError();
        }

        if (
          user.failedLoginAttempts !== 0 ||
          user.lockedUntil !== null ||
          user.lockoutCount !== 0
        ) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: null,
              lockoutCount: 0,
            },
          });
        }

        const offHours = isOffHours();
        await recordSecurityEvent({
          userId: user.id,
          action: "LOGIN_SUCCESS",
          email: user.email,
          metadata: { role: user.role, offHours },
        });
        if (offHours) {
          await recordSecurityEvent({
            userId: user.id,
            action: "LOGIN_OFFHOURS",
            email: user.email,
          });
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          memberId: user.member?.id ?? null,
          departmentIds: user.departments.map((d) => d.departmentId),
          totpEnabled: user.totpEnabled,
        };
      },
    }),
  ],
  callbacks: {
    authorized: authConfig.callbacks!.authorized!,
    session: authConfig.callbacks!.session!,
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
          select: { id: true, approved: true },
        });
        return !!(dbUser?.approved);
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      const nowS = Math.floor(Date.now() / 1000);

      // Impersonação (admin "entra como" associado). Disparado por
      // unstable_update. A revalidação de papel AQUI é a autoridade — o
      // endpoint de update é forjável, então a server action não basta.
      if (trigger === "update" && session && typeof session === "object") {
        const data = (session as { impersonate?: { action?: string; targetUserId?: string } })
          .impersonate;

        if (data?.action === "start" && normalizeRole(token.role) === "ADMIN" && !token.impersonator) {
          const target = await prisma.user.findUnique({
            where: { id: data.targetUserId ?? "" },
            include: { member: { select: { id: true } } },
          });
          if (target && normalizeRole(target.role) === "ASSOCIADO" && target.approved && target.member) {
            token.impersonator = {
              id: token.id as string,
              role: token.role as string,
              memberId: (token.memberId as string | null) ?? null,
              departmentIds: (token.departmentIds as string[]) ?? [],
              totpEnabled: (token.totpEnabled as boolean) ?? false,
              name: token.name,
              email: token.email,
            };
            token.id = target.id;
            token.role = "ASSOCIADO";
            token.memberId = target.member.id;
            token.departmentIds = [];
            token.totpEnabled = false;
            token.name = target.name;
            token.email = target.email;
            token.expiresAt = nowS + SESSION_MAX_AGE_SECONDS.ASSOCIADO;
          }
          return token;
        }

        if (data?.action === "stop" && token.impersonator) {
          const imp = token.impersonator as Impersonator;
          token.id = imp.id;
          token.role = imp.role;
          token.memberId = imp.memberId;
          token.departmentIds = imp.departmentIds;
          token.totpEnabled = imp.totpEnabled;
          token.name = imp.name;
          token.email = imp.email;
          token.impersonator = null;
          token.expiresAt = nowS + SESSION_MAX_AGE_SECONDS[normalizeRole(imp.role)];
          return token;
        }

        return token;
      }

      if (user) {
        if (account?.provider === "google") {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: {
              member: { select: { id: true } },
              departments: { select: { departmentId: true } },
            },
          });
          if (!dbUser) return token;
          const role = normalizeRole(dbUser.role);
          token.id = dbUser.id;
          token.role = role;
          token.memberId = dbUser.member?.id ?? null;
          token.departmentIds = dbUser.departments.map((d) => d.departmentId);
          token.totpEnabled = false;
          token.expiresAt = nowS + SESSION_MAX_AGE_SECONDS[role];
          return token;
        }

        // Credentials — campos já populados pelo authorize()
        token.id = user.id as string;
        const role = normalizeRole((user as { role?: string }).role);
        token.role = role;
        token.memberId = (user as { memberId?: string | null }).memberId ?? null;
        token.departmentIds = (user as { departmentIds?: string[] }).departmentIds ?? [];
        token.totpEnabled = (user as { totpEnabled?: boolean }).totpEnabled ?? false;
        token.expiresAt = nowS + SESSION_MAX_AGE_SECONDS[role];
        return token;
      }

      // Requisições subsequentes — desliza expiração (idle timeout)
      const role = normalizeRole(token.role);
      if (typeof token.expiresAt === "number" && nowS <= token.expiresAt) {
        token.expiresAt = nowS + SESSION_MAX_AGE_SECONDS[role];
      }
      return token;
    },
  },
});

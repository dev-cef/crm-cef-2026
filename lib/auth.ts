import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { normalizeRecoveryCode, verifyTotp } from "@/lib/totp";
import { isOffHours, recordSecurityEvent } from "@/lib/audit";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        token: { label: "Código 2FA", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

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
});

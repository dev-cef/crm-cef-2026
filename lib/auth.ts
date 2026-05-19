import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
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

        // Conta bloqueada por tentativas falhas
        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          if (attempts >= MAX_FAILED_ATTEMPTS) {
            const nextLockoutCount = user.lockoutCount + 1;
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: 0,
                lockoutCount: nextLockoutCount,
                lockedUntil: new Date(
                  Date.now() + lockoutDurationMs(user.lockoutCount),
                ),
              },
            });
          } else {
            await prisma.user.update({
              where: { id: user.id },
              data: { failedLoginAttempts: attempts },
            });
          }
          return null;
        }

        // Sucesso → zera contadores de bloqueio
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

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          memberId: user.member?.id ?? null,
          departmentIds: user.departments.map((d) => d.departmentId),
        };
      },
    }),
  ],
});

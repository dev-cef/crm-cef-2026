import type { NextAuthConfig } from "next-auth";
import {
  MAX_SESSION_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
  homePathForRole,
  isRouteAllowed,
  normalizeRole,
} from "@/lib/rbac";

// Configuração base, sem provedores nem acesso ao banco.
// Usada tanto pelo proxy (route protection, edge) quanto pela config completa.
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  // updateAge: 0 → cookie de sessão reescrito a cada requisição, para
  // o expiresAt deslizado (idle timeout) persistir entre requests.
  session: {
    strategy: "jwt",
    maxAge: MAX_SESSION_AGE_SECONDS,
    updateAge: 0,
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const user = auth?.user;
      const isLoggedIn = !!user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      // Rotas públicas: validação de carteirinha (QR), auto-cadastro e reset de senha
      if (nextUrl.pathname.startsWith("/validar")) return true;
      if (nextUrl.pathname.startsWith("/criar-conta")) return true;
      if (nextUrl.pathname.startsWith("/ativar-acesso")) return true;
      if (nextUrl.pathname.startsWith("/esqueci-a-senha")) return true;
      if (nextUrl.pathname.startsWith("/redefinir-senha")) return true;

      if (isOnLogin) {
        if (isLoggedIn) {
          const role = normalizeRole(user.role);
          return Response.redirect(
            new URL(homePathForRole(role), nextUrl),
          );
        }
        return true;
      }

      if (!isLoggedIn) return false;

      // Expiração absoluta por papel — sessão vencida volta ao login.
      if (user.expiresAt && Date.now() / 1000 > user.expiresAt) {
        return false;
      }

      // Gate de rota por papel (ADMIN passa em tudo).
      const role = normalizeRole(user.role);
      if (!isRouteAllowed(nextUrl.pathname, role)) {
        return Response.redirect(
          new URL(homePathForRole(role), nextUrl),
        );
      }

      return true;
    },
    jwt({ token, user }) {
      const nowS = Math.floor(Date.now() / 1000);
      if (user) {
        token.id = user.id as string;
        const role = normalizeRole((user as { role?: string }).role);
        token.role = role;
        token.memberId = (user as { memberId?: string | null }).memberId ?? null;
        token.departmentIds =
          (user as { departmentIds?: string[] }).departmentIds ?? [];
        token.totpEnabled =
          (user as { totpEnabled?: boolean }).totpEnabled ?? false;
        token.expiresAt = nowS + SESSION_MAX_AGE_SECONDS[role];
        return token;
      }
      // Chamada subsequente = atividade. Se ainda dentro da janela,
      // desliza o vencimento (idle timeout). Se já expirou, NÃO desliza
      // — authorized() rejeita e manda pro login.
      const role = normalizeRole(token.role);
      if (typeof token.expiresAt === "number" && nowS <= token.expiresAt) {
        token.expiresAt = nowS + SESSION_MAX_AGE_SECONDS[role];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = normalizeRole(token.role);
        session.user.memberId = (token.memberId as string | null) ?? null;
        session.user.departmentIds = (token.departmentIds as string[]) ?? [];
        session.user.totpEnabled = (token.totpEnabled as boolean) ?? false;
        session.user.expiresAt = (token.expiresAt as number) ?? 0;
        session.user.impersonator =
          (token.impersonator as import("@/lib/rbac").Impersonator | null | undefined) ?? null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

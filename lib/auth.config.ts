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
  session: { strategy: "jwt", maxAge: MAX_SESSION_AGE_SECONDS },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const user = auth?.user;
      const isLoggedIn = !!user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      // Rota pública de validação da carteirinha (via QR Code)
      if (nextUrl.pathname.startsWith("/validar")) return true;

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
      if (user) {
        token.id = user.id as string;
        const role = normalizeRole((user as { role?: string }).role);
        token.role = role;
        token.memberId = (user as { memberId?: string | null }).memberId ?? null;
        token.departmentIds =
          (user as { departmentIds?: string[] }).departmentIds ?? [];
        token.expiresAt =
          Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS[role];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = normalizeRole(token.role);
        session.user.memberId = (token.memberId as string | null) ?? null;
        session.user.departmentIds = (token.departmentIds as string[]) ?? [];
        session.user.expiresAt = (token.expiresAt as number) ?? 0;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

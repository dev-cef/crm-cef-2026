import type { NextAuthConfig } from "next-auth";

// Configuração base, sem provedores nem acesso ao banco.
// Usada tanto pelo proxy (route protection) quanto pela config completa.
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");

      // Rota pública de validação da carteirinha (via QR Code)
      if (nextUrl.pathname.startsWith("/validar")) return true;

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      // Qualquer outra rota exige login; NextAuth redireciona p/ pages.signIn
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role?: string }).role ?? "ADMIN";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "ADMIN";
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;

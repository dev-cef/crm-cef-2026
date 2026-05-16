import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Next.js 16: `middleware` foi renomeado para `proxy` (runtime nodejs).
// Proteção de rotas via callback `authorized` da authConfig.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

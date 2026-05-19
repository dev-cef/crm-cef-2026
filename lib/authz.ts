import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  ROLE_LEVEL,
  toSessionUser,
  type Role,
  type SessionUser,
} from "@/lib/rbac";

// Guards de servidor — usar em server components / server actions.

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return toSessionUser(session.user);
}

// Garante AO MENOS o nível do papel exigido (ADMIN passa em tudo).
export async function requireRole(min: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (ROLE_LEVEL[user.role] < ROLE_LEVEL[min]) redirect("/dashboard");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  return requireRole("ADMIN");
}

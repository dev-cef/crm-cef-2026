import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { toSessionUser, type SessionUser } from "@/lib/rbac";
import type { ModuleSlug, PermissionAction } from "@/lib/modules";

// Mensagem padrão de negação para retornos { ok, error } das server actions.
export const SEM_PERMISSAO = "Você não tem permissão para esta ação.";

// Guarda de autorização para server actions de escrita.
//
// A proteção de ROTA vive no proxy.ts (navegação). Server actions são
// endpoints POST independentes que o proxy NÃO cobre — por isso cada action
// de escrita precisa validar sessão + permissão de módulo por conta própria.
//
// Retorna o SessionUser quando autorizado, ou null quando não há sessão ou
// falta a permissão. Uso típico:
//
//   const user = await requirePermission("financeiro", "create");
//   if (!user) return { ok: false, error: SEM_PERMISSAO };
export async function requirePermission(
  module: ModuleSlug,
  action: PermissionAction,
): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = toSessionUser(session.user);
  return (await can(user, module, action)) ? user : null;
}

// Exige apenas sessão autenticada, sem checar permissão de módulo.
// Para ações de autoatendimento do associado (ex.: inscrever-se num evento,
// oferecer carona), que não passam pelo sistema de permissões por módulo.
// Retorna null quando não há sessão.
export async function requireSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return toSessionUser(session.user);
}

// True para papéis de gestão (staff). ASSOCIADO é sempre false.
export function isStaff(user: SessionUser): boolean {
  return user.role === "ADMIN" || user.role === "DEPARTAMENTO";
}

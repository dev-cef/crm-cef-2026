import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import type { ModuleSlug, PermissionAction } from "@/lib/modules";

interface Props {
  module: ModuleSlug;
  action: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Server Component — resolve permissões no servidor (sem flash de loading).
 * Use nos Server Components; use <PermissionGate> nos Client Components.
 */
export async function ServerPermissionGate({
  module,
  action,
  children,
  fallback = null,
}: Props) {
  const session = await auth();
  if (!session?.user) return <>{fallback}</>;
  const user = toSessionUser(session.user);
  const allowed = await can(user, module, action);
  return allowed ? <>{children}</> : <>{fallback}</>;
}

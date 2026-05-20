"use client";

import { usePermissions } from "@/hooks/usePermissions";
import type { ModuleSlug, PermissionAction } from "@/lib/modules";

interface Props {
  module: ModuleSlug;
  action: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renderiza `children` somente se o usuário tem a permissão solicitada.
 * Enquanto carrega, não renderiza nada (evita flash de conteúdo protegido).
 *
 * Uso:
 *   <PermissionGate module="financeiro" action="export">
 *     <BotaoExportar />
 *   </PermissionGate>
 *
 *   <PermissionGate module="associados" action="delete" fallback={<BotaoDesabilitado />}>
 *     <BotaoExcluir />
 *   </PermissionGate>
 */
export function PermissionGate({ module, action, children, fallback = null }: Props) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  return can(module, action) ? <>{children}</> : <>{fallback}</>;
}

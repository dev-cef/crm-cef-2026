import { prisma } from "@/lib/prisma";
import {
  ALL_PERMISSIONS,
  CRM_MODULES,
  DEFAULT_DEPT_PERMISSIONS,
  NO_PERMISSIONS,
  type ModulePermissions,
  type ModuleSlug,
  type PermissionAction,
  type PermissionMap,
} from "@/lib/modules";

// Monta PermissionMap para ADMIN — acesso total em todos os módulos.
function adminPermissions(): PermissionMap {
  return Object.fromEntries(
    CRM_MODULES.map((m) => [m.slug, { ...ALL_PERMISSIONS }]),
  ) as PermissionMap;
}

// Monta PermissionMap para ASSOCIADO — somente view em carteirinha.
function associadoPermissions(): PermissionMap {
  return Object.fromEntries(
    CRM_MODULES.map((m) => [
      m.slug,
      m.slug === "carteirinha"
        ? { view: true, create: false, edit: false, delete: false, export: false }
        : { ...NO_PERMISSIONS },
    ]),
  ) as PermissionMap;
}

// Resolve permissões efetivas para um usuário DEPARTAMENTO.
// Override individual tem prioridade sobre a permissão do departamento.
// Se não há registro de permissão do dept, usa DEFAULT_DEPT_PERMISSIONS.
async function resolveForDepartamento(
  userId: string,
  departmentIds: string[],
): Promise<PermissionMap> {
  const [deptPerms, overrides] = await Promise.all([
    departmentIds.length > 0
      ? prisma.deptModulePermission.findMany({
          where: { departmentId: { in: departmentIds } },
        })
      : Promise.resolve([]),
    prisma.userModuleOverride.findMany({ where: { userId } }),
  ]);

  return Object.fromEntries(
    CRM_MODULES.map(({ slug }) => {
      // Permissão efetiva do departamento: UNION de todos os depts do usuário.
      const deptRows = deptPerms.filter((p) => p.moduleSlug === slug);
      let deptPerm: ModulePermissions;
      if (deptRows.length === 0) {
        deptPerm = { ...DEFAULT_DEPT_PERMISSIONS };
      } else {
        deptPerm = {
          view:   deptRows.some((r) => r.canView),
          create: deptRows.some((r) => r.canCreate),
          edit:   deptRows.some((r) => r.canEdit),
          delete: deptRows.some((r) => r.canDelete),
          export: deptRows.some((r) => r.canExport),
        };
      }

      // Override individual (null = não sobrepõe).
      const override = overrides.find((o) => o.moduleSlug === slug);
      if (!override) return [slug, deptPerm];

      const merged: ModulePermissions = {
        view:   override.canView   ?? deptPerm.view,
        create: override.canCreate ?? deptPerm.create,
        edit:   override.canEdit   ?? deptPerm.edit,
        delete: override.canDelete ?? deptPerm.delete,
        export: override.canExport ?? deptPerm.export,
      };
      return [slug, merged];
    }),
  ) as PermissionMap;
}

export async function resolveUserPermissions(user: {
  id: string;
  role: string;
  departmentIds: string[];
}): Promise<PermissionMap> {
  if (user.role === "ADMIN") return adminPermissions();
  if (user.role === "ASSOCIADO") return associadoPermissions();
  return resolveForDepartamento(user.id, user.departmentIds);
}

// Verifica uma única ação — útil em server components/actions.
export async function can(
  user: { id: string; role: string; departmentIds: string[] },
  module: ModuleSlug,
  action: PermissionAction,
): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  const map = await resolveUserPermissions(user);
  return map[module]?.[action] ?? false;
}

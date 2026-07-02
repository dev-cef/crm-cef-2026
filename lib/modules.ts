// Módulos do CRM CEF — slugs fixos usados em DeptModulePermission e UserModuleOverride.
// ADMIN sempre tem acesso total; este sistema afeta apenas DEPARTAMENTO.

export const CRM_MODULES = [
  { slug: "dashboard",       label: "Dashboard",       icon: "LayoutDashboard" },
  { slug: "associados",      label: "Associados",      icon: "Users" },
  { slug: "financeiro",      label: "Financeiro",      icon: "Wallet" },
  { slug: "fornecedores",    label: "Fornecedores",    icon: "Truck" },
  { slug: "eventos",         label: "Eventos",         icon: "CalendarDays" },
  { slug: "aniversariantes", label: "Aniversariantes", icon: "Cake" },
  { slug: "mensageiro",      label: "Mensageiro",      icon: "MessagesSquare" },
  { slug: "carteirinha",     label: "Carteirinha",     icon: "CreditCard" },
  { slug: "patrimonio",      label: "Patrimônio",      icon: "Package" },
  { slug: "biblioteca",      label: "Biblioteca",       icon: "BookOpen" },
] as const;

export type ModuleSlug = (typeof CRM_MODULES)[number]["slug"];

export const MODULE_SLUGS = CRM_MODULES.map((m) => m.slug) as unknown as [
  ModuleSlug,
  ...ModuleSlug[],
];

export type PermissionAction = "view" | "edit" | "create" | "delete" | "export";

export const PERMISSION_ACTIONS: {
  key: PermissionAction;
  label: string;
  // Se true, este campo pode ser bloqueado por depender de outros.
  // delete requer view + edit; export requer view; create requer view.
  requires?: PermissionAction[];
}[] = [
  { key: "view",   label: "Visualizar" },
  { key: "create", label: "Criar",      requires: ["view"] },
  { key: "edit",   label: "Editar",     requires: ["view"] },
  { key: "delete", label: "Excluir",    requires: ["view", "edit"] },
  { key: "export", label: "Exportar",   requires: ["view"] },
];

export type ModulePermissions = Record<PermissionAction, boolean>;
export type PermissionMap = Record<ModuleSlug, ModulePermissions>;

// Permissões padrão quando não há registro no banco (mantém acesso existente).
export const DEFAULT_DEPT_PERMISSIONS: ModulePermissions = {
  view:   true,
  create: true,
  edit:   true,
  delete: false,
  export: true,
};

// Permissões completas (ADMIN).
export const ALL_PERMISSIONS: ModulePermissions = {
  view: true, create: true, edit: true, delete: true, export: true,
};

// Sem acesso (fallback para módulos não mapeados).
export const NO_PERMISSIONS: ModulePermissions = {
  view: false, create: false, edit: false, delete: false, export: false,
};

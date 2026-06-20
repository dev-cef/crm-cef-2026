import { z } from "zod";

// Primitivas RBAC puras — sem dependências de servidor (prisma/bcrypt/auth).
// Seguro para importar no proxy/middleware (edge).

export const ROLES = {
  ADMIN: "ADMIN",
  DEPARTAMENTO: "DEPARTAMENTO",
  ASSOCIADO: "ASSOCIADO",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LEVEL: Record<Role, number> = {
  ADMIN: 3,
  DEPARTAMENTO: 2,
  ASSOCIADO: 1,
};

export const roleSchema = z.enum(["ADMIN", "DEPARTAMENTO", "ASSOCIADO"]);

// Timeout de sessão por papel (segundos). Maior privilégio = janela menor.
export const SESSION_MAX_AGE_SECONDS: Record<Role, number> = {
  ADMIN: 30 * 60,
  DEPARTAMENTO: 60 * 60,
  ASSOCIADO: 120 * 60,
};

// Maior janela — usada como maxAge global do cookie de sessão.
export const MAX_SESSION_AGE_SECONDS = Math.max(
  ...Object.values(SESSION_MAX_AGE_SECONDS),
);

export function normalizeRole(value: unknown): Role {
  const parsed = roleSchema.safeParse(value);
  return parsed.success ? parsed.data : "ADMIN";
}

export type SessionUser = {
  id: string;
  role: Role;
  memberId: string | null;
  departmentIds: string[];
};

export function toSessionUser(user: {
  id?: string;
  role?: string;
  memberId?: string | null;
  departmentIds?: string[];
}): SessionUser {
  return {
    id: user.id ?? "",
    role: normalizeRole(user.role),
    memberId: user.memberId ?? null,
    departmentIds: user.departmentIds ?? [],
  };
}

export function isAdmin(user: { role?: string } | null | undefined): boolean {
  return normalizeRole(user?.role) === "ADMIN";
}

export function hasAtLeast(
  user: { role?: string } | null | undefined,
  min: Role,
): boolean {
  return ROLE_LEVEL[normalizeRole(user?.role)] >= ROLE_LEVEL[min];
}

// Filtro Prisma de isolamento por papel — combinar (AND) com o where existente:
//   where: { ...filtrosAtuais, ...scopedMemberWhere(user) }
// ADMIN / DEPARTAMENTO: {} (veem todos os associados; acesso controlado pelo módulo de permissões)
// ASSOCIADO: só o próprio registro
export function scopedMemberWhere(user: SessionUser) {
  if (user.role === "ASSOCIADO") return { userId: user.id };
  return {};
}

// Isolamento de eventos por papel. ASSOCIADO não tem escopo departamental
// (vê via inscrição, controlado na UI); DEPARTAMENTO restringe ao(s) seu(s).
export function scopedEventWhere(user: SessionUser) {
  if (user.role === "ADMIN" || user.role === "ASSOCIADO") return {};
  return { departmentId: { in: user.departmentIds } };
}

// Mapa de acesso por prefixo de rota. ADMIN acessa tudo.
export const ROUTE_ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/relatorios",    roles: ["ADMIN", "DEPARTAMENTO"] },
  { prefix: "/financeiro",    roles: ["ADMIN", "DEPARTAMENTO"] },
  { prefix: "/configuracoes", roles: ["ADMIN"] },
  { prefix: "/associados",    roles: ["ADMIN", "DEPARTAMENTO"] },
  { prefix: "/aniversariantes", roles: ["ADMIN", "DEPARTAMENTO"] },
  { prefix: "/fornecedores",  roles: ["ADMIN", "DEPARTAMENTO"] },
  { prefix: "/eventos",       roles: ["ADMIN", "DEPARTAMENTO", "ASSOCIADO"] },
  { prefix: "/meu-espaco",    roles: ["ADMIN", "ASSOCIADO"] },
  { prefix: "/carteirinha",   roles: ["ADMIN", "DEPARTAMENTO", "ASSOCIADO"] },
  { prefix: "/dashboard",     roles: ["ADMIN", "DEPARTAMENTO"] },
  { prefix: "/patrimonio",    roles: ["ADMIN", "DEPARTAMENTO"] },
];

export function isRouteAllowed(pathname: string, role: Role): boolean {
  if (role === "ADMIN") return true;
  const match = ROUTE_ACCESS.find((r) => pathname.startsWith(r.prefix));
  if (!match) return true; // rota não mapeada: não bloqueia (telas neutras)
  return match.roles.includes(role);
}

// Página inicial de cada papel após login / ao bater em rota bloqueada.
export function homePathForRole(role: Role): string {
  return role === "ASSOCIADO" ? "/meu-espaco" : "/dashboard";
}

// Itens de navegação com o papel mínimo exigido. A sidebar usa isto
// para decidir mostrar normal / mostrar com cadeado / esconder.
export type NavRole = Role | "HIDDEN";

export const NAV_ITEMS: {
  href: string;
  label: string;
  visibleTo?: Role[];
  moduleSlug?: string; // se definido, item é ocultado quando canView=false para esse módulo
  children?: { href: string; label: string; visibleTo?: Role[] }[];
}[] = [
  { href: "/dashboard",       label: "Dashboard",       visibleTo: ["ADMIN", "DEPARTAMENTO"], moduleSlug: "dashboard" },
  { href: "/meu-espaco",       label: "Meu Espaço",       visibleTo: ["ASSOCIADO"] },
  { href: "/eventos",          label: "Meus Eventos",     visibleTo: ["ASSOCIADO"] },
  { href: "/associados",       label: "Associados",       visibleTo: ["ADMIN", "DEPARTAMENTO"], moduleSlug: "associados" },
  {
    href: "/carteirinha",
    label: "Carteirinha",
    moduleSlug: "carteirinha",
    children: [
      { href: "/carteirinha/fisica", label: "Carteirinha Física", visibleTo: ["ADMIN"] },
    ],
  },
  { href: "/aniversariantes", label: "Aniversariantes", visibleTo: ["ADMIN", "DEPARTAMENTO"], moduleSlug: "aniversariantes" },
  {
    href: "/financeiro",
    label: "Financeiro",
    visibleTo: ["ADMIN", "DEPARTAMENTO"],
    moduleSlug: "financeiro" as const,
    children: [
      { href: "/financeiro/caixa",        label: "Caixa" },
      { href: "/financeiro/pagamentos",   label: "Pagamentos" },
      { href: "/financeiro/planos",       label: "Planos" },
      { href: "/financeiro/categorias",   label: "Categorias" },
    ],
  },
  {
    href: "/fornecedores",
    label: "Fornecedores",
    visibleTo: ["ADMIN", "DEPARTAMENTO"],
    moduleSlug: "fornecedores",
    children: [
      { href: "/fornecedores/categorias", label: "Categorias" },
    ],
  },
  { href: "/eventos",         label: "Eventos e Atividades", visibleTo: ["ADMIN", "DEPARTAMENTO"], moduleSlug: "eventos" },
  { href: "/patrimonio",      label: "Patrimônio",           visibleTo: ["ADMIN", "DEPARTAMENTO"], moduleSlug: "patrimonio" },
  { href: "/relatorios",      label: "Relatórios",           visibleTo: ["ADMIN", "DEPARTAMENTO"] },
];

export const CONFIG_NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/configuracoes/seguranca",    label: "Usuários" },
  { href: "/configuracoes/departamentos", label: "Departamentos" },
  { href: "/configuracoes/aprovacoes",   label: "Aprovações" },
  { href: "/configuracoes/auditoria",    label: "Auditoria" },
  { href: "/configuracoes/backup",       label: "Backup" },
];

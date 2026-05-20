import Link from "next/link";
import {
  Eye,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  FileSpreadsheet,
  Upload,
  Crown,
  UserCheck,
  Users,
  CornerDownRight,
  X,
  CalendarClock,
  Clock,
  ArrowRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { scopedMemberWhere, toSessionUser } from "@/lib/rbac";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { stripCpf } from "@/lib/cpf";
import { calculateAge, toBrDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteMemberDialog } from "@/components/modules/associados/delete-member-dialog";
import { ImportCsvDialog } from "@/components/modules/associados/import-csv-dialog";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function membershipLabel(createdAt: Date): string {
  const now = new Date();
  const years = calculateAge(createdAt);
  if (years >= 1) return `Sócio há: ${years} ${years === 1 ? "ano" : "anos"}`;
  const months =
    (now.getFullYear() - createdAt.getFullYear()) * 12 +
    (now.getMonth() - createdAt.getMonth());
  if (months <= 0) return "Sócio há: < 1 mês";
  return `Sócio há: ${months} ${months === 1 ? "mês" : "meses"}`;
}
type Role = "titular" | "dependente" | "individual";
type Since = "lt1" | "1to5" | "5to10" | "10to20" | "gt30";

const SINCE_OPTIONS: { key: Since; label: string; description: string }[] = [
  { key: "lt1",   label: "< 1 ano",    description: "Menos de 1 ano" },
  { key: "1to5",  label: "1–5 anos",   description: "Entre 1 e 5 anos" },
  { key: "5to10", label: "5–10 anos",  description: "Entre 5 e 10 anos" },
  { key: "10to20",label: "10–20 anos", description: "Entre 10 e 20 anos" },
  { key: "gt30",  label: "+ 30 anos",  description: "Mais de 30 anos" },
];

function sinceToDateRange(since: Since): { gte?: Date; lte?: Date } {
  const now = new Date();
  const yearsAgo = (y: number) =>
    new Date(now.getFullYear() - y, now.getMonth(), now.getDate());
  if (since === "lt1")    return { gte: yearsAgo(1) };
  if (since === "1to5")   return { gte: yearsAgo(5),  lte: yearsAgo(1) };
  if (since === "5to10")  return { gte: yearsAgo(10), lte: yearsAgo(5) };
  if (since === "10to20") return { gte: yearsAgo(20), lte: yearsAgo(10) };
  return { lte: yearsAgo(30) };
}

type SearchParams = Promise<{
  q?: string;
  status?: string;
  page?: string;
  role?: string;
  since?: string;
}>;

export default async function AssociadosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireRole("DEPARTAMENTO");
  const isAdmin = user.role === "ADMIN";

  const session = await auth();
  const sessionUser = toSessionUser(session!.user);
  const [canCreate, canEdit, canDelete, canExport] = await Promise.all([
    can(sessionUser, "associados", "create"),
    can(sessionUser, "associados", "edit"),
    can(sessionUser, "associados", "delete"),
    can(sessionUser, "associados", "export"),
  ]);

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status ?? "ACTIVE";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const role = (["titular", "dependente", "individual"].includes(sp.role ?? "")
    ? sp.role
    : "ALL") as Role | "ALL";
  const since = (["lt1", "1to5", "5to10", "10to20", "gt30"].includes(sp.since ?? "")
    ? sp.since
    : "ALL") as Since | "ALL";

  // ── Where clause ──────────────────────────────────────────────────
  type AndClause = Record<string, unknown>;
  const and: AndClause[] = [{ deletedAt: null }, scopedMemberWhere(user)];

  if (status === "ACTIVE" || status === "INACTIVE") and.push({ status });

  if (q) {
    const digits = stripCpf(q);
    and.push({
      OR: [
        { fullName: { contains: q } },
        { email: { contains: q } },
        ...(digits ? [{ cpf: { contains: digits } }] : []),
      ],
    });
  }

  if (since !== "ALL") {
    const range = sinceToDateRange(since);
    and.push({ createdAt: range });
    and.push({ titular: { is: null } });
  }

  if (role === "titular") {
    and.push({ titularId: null });
    and.push({ plan: { name: { contains: "Família" } } });
  } else if (role === "dependente") {
    and.push({ titularId: { not: null } });
  } else if (role === "individual") {
    and.push({ titularId: null });
    and.push({
      OR: [
        { planId: null },
        { plan: { name: { not: { contains: "Família" } } } },
      ],
    });
  }

  const where = { AND: and };

  const [total, raw, pendingCount] = await Promise.all([
    prisma.member.count({ where }),
    prisma.member.findMany({
      where,
      include: {
        plan: true,
        titular: { select: { id: true, fullName: true, registration: true } },
        dependente: {
          select: {
            id: true,
            fullName: true,
            registration: true,
            photoUrl: true,
            status: true,
          },
        },
        user: { select: { approved: true } },
      },
      orderBy: { fullName: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    isAdmin ? prisma.user.count({ where: { approved: false } }) : Promise.resolve(0),
  ]);

  // ── Grouping ───────────────────────────────────────────────────────
  const dependentes = raw.filter((m) => !!m.titularId);
  const nonDependentes = raw.filter((m) => !m.titularId);
  type MemberRow = (typeof raw)[number];
  const grouped: MemberRow[] = [];
  for (const t of nonDependentes) {
    grouped.push(t);
    const dep = dependentes.find((d) => d.titularId === t.id);
    if (dep) grouped.push(dep);
  }
  for (const d of dependentes) {
    if (!grouped.includes(d)) grouped.push(d);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── URL helpers ───────────────────────────────────────────────────
  function buildHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("status", status);
    if (role !== "ALL") p.set("role", role);
    if (since !== "ALL") p.set("since", since);
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined || v === "") p.delete(k);
      else p.set(k, v);
    });
    const str = p.toString();
    return `/associados${str ? `?${str}` : ""}`;
  }

  function roleHref(r: Role) {
    return buildHref({ role: role === r ? "ALL" : r, page: "1" });
  }

  function sinceHref(s: Since) {
    return buildHref({ since: since === s ? "ALL" : s, page: "1" });
  }

  const exportHref = buildHref({ page: undefined }).replace(
    "/associados",
    "/associados/export",
  );

  const ROLE_FILTERS = [
    {
      key: "titular" as Role,
      label: "Titular do plano Família",
      icon: Crown,
      active: "bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/40 dark:border-amber-600 dark:text-amber-300",
      inactive: "border-muted-foreground/20 text-muted-foreground hover:bg-muted/60",
      iconColor: "text-amber-500",
    },
    {
      key: "dependente" as Role,
      label: "Dependente (cônjuge)",
      icon: UserCheck,
      active: "bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-300",
      inactive: "border-muted-foreground/20 text-muted-foreground hover:bg-muted/60",
      iconColor: "text-blue-500",
    },
    {
      key: "individual" as Role,
      label: "Sócio individual",
      icon: Users,
      active: "bg-muted border-foreground/30 text-foreground",
      inactive: "border-muted-foreground/20 text-muted-foreground hover:bg-muted/60",
      iconColor: "text-muted-foreground",
    },
  ] as const;

  return (
    <div>
      <PageHeader
        title="Associados"
        description={`${total} associado(s) encontrado(s)`}
      >
        {canExport && (
          <Link
            href={exportHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            prefetch={false}
          >
            <FileSpreadsheet className="size-4" /> Exportar Excel
          </Link>
        )}
        {canCreate && (
          <ImportCsvDialog>
            <Button variant="outline" size="sm">
              <Upload className="size-4" /> Importar CSV
            </Button>
          </ImportCsvDialog>
        )}
        {canCreate && (
          <Link href="/associados/novo" className={cn(buttonVariants({ size: "sm" }))}>
            <UserPlus className="size-4" /> Novo associado
          </Link>
        )}
      </PageHeader>

      {/* ── Banner: aprovações pendentes ── */}
      {isAdmin && pendingCount > 0 && (
        <Link
          href="/configuracoes/aprovacoes"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:hover:bg-amber-950/60"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-400/20">
              <Clock className="size-4 text-amber-600 dark:text-amber-400" />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {pendingCount === 1
                  ? "1 associado aguardando aprovação"
                  : `${pendingCount} associados aguardando aprovação`}
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-400/70">
                Auto-cadastros pelo site — aprovação libera o acesso ao sistema
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            Revisar <ArrowRight className="size-3.5" />
          </span>
        </Link>
      )}

      {/* ── Filtros de busca ── */}
      <form method="get" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {role !== "ALL" && <input type="hidden" name="role" value={role} />}
        {since !== "ALL" && <input type="hidden" name="since" value={since} />}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, CPF ou e-mail"
            className="pl-9"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="ALL">Todos os status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="INACTIVE">Inativo</option>
        </select>
        <Button type="submit" variant="secondary" size="sm">
          Filtrar
        </Button>
        {(q || status !== "ACTIVE" || role !== "ALL" || since !== "ALL") && (
          <Link
            href="/associados"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <X className="size-3.5" /> Limpar
          </Link>
        )}
      </form>

      {/* ── Filtros de tipo de sócio + tempo de sócio ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {ROLE_FILTERS.map(({ key, label, icon: Icon, active, inactive, iconColor }) => {
          const isActive = role === key;
          return (
            <Link
              key={key}
              href={roleHref(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                isActive ? active : inactive,
              )}
            >
              <Icon className={cn("size-3.5", isActive ? "" : iconColor)} />
              {label}
              {isActive && <X className="size-3 opacity-60" />}
            </Link>
          );
        })}

        {/* separator */}
        <span className="h-4 w-px bg-border" aria-hidden />

        {/* Sócio desde chips */}
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" /> Sócio há:
        </span>
        {SINCE_OPTIONS.map(({ key, label, description }) => {
          const isActive = since === key;
          return (
            <Link
              key={key}
              href={sinceHref(key)}
              title={description}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                isActive
                  ? "border-emerald-400 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-600 dark:text-emerald-300"
                  : "border-muted-foreground/20 text-muted-foreground hover:bg-muted/60",
              )}
            >
              {label}
              {isActive && <X className="size-3 opacity-60" />}
            </Link>
          );
        })}

        {(role !== "ALL" || since !== "ALL") && (
          <span className="inline-flex items-center text-xs text-muted-foreground">
            · {total} resultado{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Tabela ── */}
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4" />
              <TableHead>Associado</TableHead>
              {since !== "ALL" ? (
                <>
                  <TableHead className="hidden md:table-cell">Inscrição</TableHead>
                  <TableHead className="hidden md:table-cell">Sócio há</TableHead>
                  <TableHead className="hidden md:table-cell">Sócio desde</TableHead>
                </>
              ) : (
                <TableHead className="hidden md:table-cell">Telefone</TableHead>
              )}
              <TableHead className="hidden sm:table-cell">Plano</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={since !== "ALL" ? 7 : 5}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  {role !== "ALL"
                    ? `Nenhum associado do tipo "${ROLE_FILTERS.find((r) => r.key === role)?.label}" encontrado.`
                    : "Nenhum associado encontrado."}
                </TableCell>
              </TableRow>
            )}
            {grouped.map((m, i) => {
              const isDependent = !!m.titularId;
              const isFamilyPlan = m.plan?.name.includes("Família");
              const isTitular = isFamilyPlan && !isDependent;
              const hasDependente = !!m.dependente;
              const isPending = m.user?.approved === false;

              const prev = i > 0 ? grouped[i - 1] : null;
              const isAdjacentDependent = isDependent && prev?.id === m.titularId;

              return (
                <TableRow
                  key={m.id}
                  className={cn(
                    "group/row transition-colors",
                    isPending
                      ? "bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
                      : (isTitular && hasDependente) || isAdjacentDependent
                        ? "bg-amber-500/[0.03] hover:bg-amber-500/[0.07]"
                        : undefined,
                    isTitular && hasDependente && i > 0 && !isAdjacentDependent
                      ? "border-t-2 border-t-amber-500/20"
                      : undefined,
                  )}
                >
                  {/* Avatar */}
                  <TableCell className="pl-4 pr-0">
                    <div className={cn("flex items-center", isAdjacentDependent && "pl-5")}>
                      {isAdjacentDependent && (
                        <CornerDownRight className="mr-1.5 size-3.5 shrink-0 text-amber-400" />
                      )}
                      <div className="relative">
                        <Avatar className={cn("size-9 shrink-0", isAdjacentDependent && "size-8")}>
                          {m.photoUrl && (
                            <AvatarImage src={m.photoUrl} alt={m.fullName} />
                          )}
                          <AvatarFallback
                            className={cn(
                              "text-xs font-medium",
                              isTitular && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
                              isDependent && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
                            )}
                          >
                            {m.fullName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {isTitular && (
                          <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-amber-500 ring-2 ring-background">
                            <Crown className="size-2 text-white" />
                          </span>
                        )}
                        {isDependent && (
                          <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-blue-500 ring-2 ring-background">
                            <UserCheck className="size-2 text-white" />
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Nome */}
                  <TableCell>
                    <div className={cn(isAdjacentDependent && "pl-6")}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          href={`/associados/${m.id}`}
                          className="font-medium hover:underline"
                        >
                          {m.fullName}
                        </Link>
                        {isTitular && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                            <Crown className="size-2.5" /> Titular
                          </span>
                        )}
                        {isDependent && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                            <UserCheck className="size-2.5" /> Dependente
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                            <Clock className="size-2.5" /> Aguardando aprovação
                          </span>
                        )}
                      </div>

                      {since === "ALL" && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {isTitular && hasDependente && m.dependente && (
                            <span className="flex items-center gap-0.5">
                              <Users className="size-3" />
                              <Link
                                href={`/associados/${m.dependente.id}`}
                                className="text-amber-600 hover:underline dark:text-amber-400"
                              >
                                {m.dependente.fullName}
                              </Link>
                            </span>
                          )}
                          {isTitular && !hasDependente && isFamilyPlan && (
                            <span className="text-muted-foreground/60">sem dependente</span>
                          )}
                          {isDependent && m.titular && (
                            <span className="flex items-center gap-0.5">
                              <Crown className="size-3 text-amber-500" />
                              <span>de </span>
                              <Link
                                href={`/associados/${m.titular.id}`}
                                className="text-amber-600 hover:underline dark:text-amber-400"
                              >
                                {m.titular.fullName}
                              </Link>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Telefone  OU  Mat. + Tempo + Sócio desde */}
                  {since !== "ALL" ? (
                    <>
                      <TableCell className="hidden text-sm md:table-cell">
                        <span className="tabular-nums text-muted-foreground">
                          #{m.registration}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        {membershipLabel(m.createdAt)}
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        <span
                          title={membershipLabel(m.createdAt)}
                          className="cursor-default underline decoration-dashed decoration-muted-foreground/40 underline-offset-2"
                        >
                          {toBrDate(m.createdAt)}
                        </span>
                      </TableCell>
                    </>
                  ) : (
                    <TableCell className="hidden text-sm md:table-cell text-muted-foreground">
                      {m.phone || "—"}
                    </TableCell>
                  )}

                  {/* Plano */}
                  <TableCell className="hidden sm:table-cell">
                    {m.plan ? (
                      <Badge
                        variant="secondary"
                        className={cn(
                          isTitular && "border-amber-300/60 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                          isDependent && "border-blue-300/60 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                        )}
                      >
                        {m.plan.name}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Ações */}
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/associados/${m.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                        aria-label="Ver perfil"
                      >
                        <Eye className="size-4" />
                      </Link>
                      {canEdit && (
                        <Link
                          href={`/associados/${m.id}/editar`}
                          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Link>
                      )}
                      {canDelete && (
                        <DeleteMemberDialog
                          id={m.id}
                          name={m.fullName}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Desativar"
                              className="text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages} · {total} associados
          </p>
          <div className="flex gap-2">
            <Link
              href={buildHref({ page: String(Math.max(1, page - 1)) })}
              aria-disabled={page <= 1}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                page <= 1 && "pointer-events-none opacity-50",
              )}
            >
              Anterior
            </Link>
            <Link
              href={buildHref({ page: String(Math.min(totalPages, page + 1)) })}
              aria-disabled={page >= totalPages}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                page >= totalPages && "pointer-events-none opacity-50",
              )}
            >
              Próxima
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

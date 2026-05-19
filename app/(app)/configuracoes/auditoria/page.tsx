import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { toBrDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

const SECURITY = ["LOGIN_SUCCESS", "LOGIN_FAILED", "LOCKOUT", "LOGIN_OFFHOURS"];
const CHANGES = ["CREATE", "UPDATE", "DELETE", "EXPORT"];

const FILTERS = [
  { key: "ALL", label: "Todos" },
  { key: "SECURITY", label: "Segurança" },
  { key: "CHANGES", label: "Alterações" },
] as const;

function actionBadge(action: string) {
  if (action === "LOGIN_FAILED" || action === "LOCKOUT")
    return "destructive" as const;
  if (action === "LOGIN_OFFHOURS") return "secondary" as const;
  return "default" as const;
}

type SearchParams = Promise<{ filter?: string; page?: string }>;

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = (["ALL", "SECURITY", "CHANGES"].includes(sp.filter ?? "")
    ? sp.filter
    : "ALL") as "ALL" | "SECURITY" | "CHANGES";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const where =
    filter === "SECURITY"
      ? { action: { in: SECURITY } }
      : filter === "CHANGES"
        ? { action: { in: CHANGES } }
        : {};

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number, f: string) =>
    `/configuracoes/auditoria?filter=${f}&page=${p}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Auditoria" />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href(1, f.key)}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/Hora</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  Nenhum registro.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((l) => {
                const danger =
                  l.action === "LOGIN_FAILED" ||
                  l.action === "LOCKOUT" ||
                  l.action === "LOGIN_OFFHOURS";
                return (
                  <TableRow
                    key={l.id}
                    className={danger ? "bg-destructive/5" : undefined}
                  >
                    <TableCell className="whitespace-nowrap text-sm">
                      {toBrDate(l.createdAt)}{" "}
                      {l.createdAt.toLocaleTimeString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.user?.name ?? l.user?.email ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={actionBadge(l.action)}
                        className="gap-1"
                      >
                        {danger && <ShieldAlert className="size-3" />}
                        {l.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.entity}
                      <span className="text-muted-foreground">
                        {" "}
                        · {l.entityId.slice(0, 8)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {l.ip ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {l.metadata ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {total} registro(s) · página {page} de {pages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={href(page - 1, filter)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Anterior
            </Link>
          )}
          {page < pages && (
            <Link
              href={href(page + 1, filter)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Próxima
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

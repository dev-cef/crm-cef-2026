import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { getBens, getLocais, getResumoStats } from "@/lib/patrimonio/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BemStatusBadge } from "@/components/modules/patrimonio/bem-status-badge";
import { BemCategoriaBadge } from "@/components/modules/patrimonio/bem-categoria-badge";
import { PatrimonioStatsCards } from "@/components/modules/patrimonio/patrimonio-stats";
import { ExportButton } from "@/components/modules/patrimonio/export-button";
import type { BemFilters } from "@/lib/patrimonio/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Patrimônio — CRM CEF" };

const PAGE_SIZE = 20;

export default async function PatrimonioPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; categoria?: string; status?: string; local?: string; page?: string }>;
}) {
  const session = await auth();
  const sessionUser = toSessionUser(session!.user);
  const canCreate = await can(sessionUser, "patrimonio", "create");

  const sp = await searchParams;
  const page = Number(sp.page ?? 1);

  const filters: BemFilters = {
    search: sp.search,
    categoria: sp.categoria as BemFilters["categoria"],
    status: sp.status as BemFilters["status"],
    localId: sp.local,
    page,
  };

  const [{ bens, total }, locais, stats] = await Promise.all([
    getBens(filters),
    getLocais(),
    getResumoStats(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function pageUrl(p: number) {
    const q = new URLSearchParams();
    if (sp.search) q.set("search", sp.search);
    if (sp.categoria) q.set("categoria", sp.categoria);
    if (sp.status) q.set("status", sp.status);
    if (sp.local) q.set("local", sp.local);
    q.set("page", String(p));
    return `/patrimonio?${q}`;
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Patrimônio">
        <div className="flex gap-2">
          <ExportButton filters={filters} />
          {canCreate && (
            <Link href="/patrimonio/novo" className={cn(buttonVariants({ size: "sm" }))}>
              <Plus className="size-4 mr-1" /> Novo bem
            </Link>
          )}
        </div>
      </PageHeader>

      <PatrimonioStatsCards stats={stats} />

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3">
        <div className="flex items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-sm flex-1 min-w-48">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            name="search"
            defaultValue={sp.search}
            placeholder="Buscar por nome ou código..."
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select name="categoria" defaultValue={sp.categoria ?? ""} className="rounded-md border bg-background px-3 py-1.5 text-sm">
          <option value="">Todas as categorias</option>
          <option value="equipamento">Equipamento</option>
          <option value="movel_utensilio">Móvel / Utensílio</option>
          <option value="eletronico">Eletrônico</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="rounded-md border bg-background px-3 py-1.5 text-sm">
          <option value="">Todos os status</option>
          <option value="disponivel">Disponível</option>
          <option value="em_uso">Em uso</option>
          <option value="manutencao">Manutenção</option>
          <option value="emprestado">Emprestado</option>
          <option value="baixado">Baixado</option>
        </select>
        <select name="local" defaultValue={sp.local ?? ""} className="rounded-md border bg-background px-3 py-1.5 text-sm">
          <option value="">Todos os locais</option>
          {locais.map((l) => (
            <option key={l.id} value={l.id}>{l.nome}</option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary">Filtrar</Button>
      </form>

      {/* Tabela */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Local</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bens.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  Nenhum bem encontrado.
                </TableCell>
              </TableRow>
            )}
            {bens.map((bem) => (
              <TableRow key={bem.id}>
                <TableCell className="font-mono text-xs">{bem.codigo}</TableCell>
                <TableCell className="font-medium">{bem.nome}</TableCell>
                <TableCell><BemCategoriaBadge categoria={bem.categoria} /></TableCell>
                <TableCell><BemStatusBadge status={bem.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {bem.local?.nome ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/patrimonio/${bem.id}`} className="text-sm text-primary hover:underline">
                    Ver
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} bens encontrados</span>
          <div className="flex gap-1">
            {page > 1 && (
              <Link href={pageUrl(page - 1)} className="px-3 py-1 rounded border hover:bg-muted">← Anterior</Link>
            )}
            <span className="px-3 py-1">{page} / {totalPages}</span>
            {page < totalPages && (
              <Link href={pageUrl(page + 1)} className="px-3 py-1 rounded border hover:bg-muted">Próxima →</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

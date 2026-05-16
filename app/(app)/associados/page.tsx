import Link from "next/link";
import { Eye, Pencil, Search, Trash2, UserPlus, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { formatCpf } from "@/lib/cpf";
import { stripCpf } from "@/lib/cpf";
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

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type SearchParams = Promise<{
  q?: string;
  status?: string;
  page?: string;
}>;

export default async function AssociadosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = sp.status ?? "ALL";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const where: Record<string, unknown> = { deletedAt: null };
  if (status === "ACTIVE" || status === "INACTIVE") where.status = status;
  if (q) {
    const digits = stripCpf(q);
    where.OR = [
      { fullName: { contains: q } },
      { email: { contains: q } },
      ...(digits ? [{ cpf: { contains: digits } }] : []),
    ];
  }

  const [total, members] = await Promise.all([
    prisma.member.count({ where }),
    prisma.member.findMany({
      where,
      include: { plan: true },
      orderBy: { fullName: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (status !== "ALL") qs.set("status", status);
  const exportHref = `/associados/export${qs.toString() ? `?${qs}` : ""}`;

  function pageHref(p: number) {
    const u = new URLSearchParams(qs);
    u.set("page", String(p));
    return `/associados?${u.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Associados"
        description={`${total} associado(s) encontrado(s)`}
      >
        <Link
          href={exportHref}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          prefetch={false}
        >
          <Download className="size-4" /> Exportar CSV
        </Link>
        <Link
          href="/associados/novo"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <UserPlus className="size-4" /> Novo associado
        </Link>
      </PageHeader>

      <form
        method="get"
        className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center"
      >
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
        {(q || status !== "ALL") && (
          <Link
            href="/associados"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Limpar
          </Link>
        )}
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Foto</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">CPF</TableHead>
              <TableHead className="hidden sm:table-cell">Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhum associado encontrado.
                </TableCell>
              </TableRow>
            )}
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <Avatar className="size-9">
                    {m.photoUrl && <AvatarImage src={m.photoUrl} alt={m.fullName} />}
                    <AvatarFallback className="text-xs">
                      {m.fullName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/associados/${m.id}`}
                    className="font-medium hover:underline"
                  >
                    {m.fullName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    Matrícula #{m.registration}
                  </p>
                </TableCell>
                <TableCell className="hidden font-mono text-sm md:table-cell">
                  {formatCpf(m.cpf)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {m.plan ? (
                    <Badge variant="secondary">{m.plan.name}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={m.status === "ACTIVE" ? "default" : "secondary"}
                  >
                    {m.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Link
                      href={`/associados/${m.id}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                      )}
                      aria-label="Ver"
                    >
                      <Eye className="size-4" />
                    </Link>
                    <Link
                      href={`/associados/${m.id}/editar`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                      )}
                      aria-label="Editar"
                    >
                      <Pencil className="size-4" />
                    </Link>
                    <DeleteMemberDialog
                      id={m.id}
                      name={m.fullName}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Excluir"
                          className="text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Link
              href={pageHref(Math.max(1, page - 1))}
              aria-disabled={page <= 1}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                page <= 1 && "pointer-events-none opacity-50",
              )}
            >
              Anterior
            </Link>
            <Link
              href={pageHref(Math.min(totalPages, page + 1))}
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

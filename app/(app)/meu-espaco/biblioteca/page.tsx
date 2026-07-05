import Link from "next/link";
import { BookOpen, Search, BookMarked, Clock, CircleCheck, CircleAlert } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { requireUser } from "@/lib/authz";
import { getCatalogoParaAssociado, getEmprestimosDoSocio } from "@/lib/biblioteca/queries";
import { EMPRESTIMO_STATUS_LABELS, type EmprestimoStatus } from "@/lib/biblioteca/types";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Biblioteca — Meu Espaço CEF" };

const STATUS_BADGE: Record<EmprestimoStatus, "default" | "secondary" | "destructive"> = {
  ativo: "default",
  atrasado: "destructive",
  devolvido: "secondary",
  extraviado: "destructive",
};

export default async function MeuEspacoBibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const user = await requireUser();
  const { search, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? "1") || 1);

  const [{ livros, total, totalPages }, emprestimos] = await Promise.all([
    getCatalogoParaAssociado({ search, page }),
    user.memberId ? getEmprestimosDoSocio(user.memberId) : Promise.resolve([]),
  ]);

  const ativos = emprestimos.filter((e) => e.status === "ativo" || e.status === "atrasado");
  const historico = emprestimos.filter((e) => e.status === "devolvido" || e.status === "extraviado");

  function catalogoHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (page > 1) p.set("page", String(page));
    Object.entries(overrides).forEach(([k, v]) => {
      if (!v) p.delete(k);
      else p.set(k, v);
    });
    const s = p.toString();
    return `/meu-espaco/biblioteca${s ? `?${s}` : ""}`;
  }

  return (
    <div className="space-y-8 p-6 max-w-4xl">
      <PageHeader
        title="Biblioteca do CEF"
        description="Consulte o acervo do clube e acompanhe os seus empréstimos"
      />

      {/* ── Meus empréstimos ── */}
      {ativos.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <BookMarked className="size-4 text-primary" /> Empréstimos em aberto
            <span className="text-xs font-normal text-muted-foreground">({ativos.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ativos.map((e) => {
              const atrasado = e.status === "atrasado";
              return (
                <div
                  key={e.id}
                  className={cn(
                    "rounded-xl border p-4 space-y-1",
                    atrasado ? "border-destructive/40 bg-destructive/5" : "bg-card",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm leading-tight">{e.livro.titulo}</p>
                    <Badge variant={STATUS_BADGE[e.status as EmprestimoStatus]} className="shrink-0">
                      {EMPRESTIMO_STATUS_LABELS[e.status as EmprestimoStatus]}
                    </Badge>
                  </div>
                  {e.livro.autor && (
                    <p className="text-xs text-muted-foreground">{e.livro.autor}</p>
                  )}
                  <p className={cn("flex items-center gap-1 text-xs", atrasado ? "text-destructive" : "text-muted-foreground")}>
                    <Clock className="size-3.5" />
                    {atrasado ? "Devolução vencida em " : "Devolver até "}
                    {format(new Date(e.prazoDevolucao), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            A devolução é registrada pela secretaria no balcão da sede.
          </p>
        </section>
      )}

      {historico.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <CircleCheck className="size-4" /> Histórico de empréstimos ({historico.length})
          </h2>
          <ul className="divide-y rounded-xl border text-sm">
            {historico.slice(0, 20).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 px-4 py-2">
                <span className="min-w-0 truncate">{e.livro.titulo}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {e.devolvidoEm
                    ? `Devolvido em ${format(new Date(e.devolvidoEm), "dd/MM/yyyy", { locale: ptBR })}`
                    : EMPRESTIMO_STATUS_LABELS[e.status as EmprestimoStatus]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Acervo ── */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <BookOpen className="size-4 text-primary" /> Acervo
          <span className="text-xs font-normal text-muted-foreground">({total} livros)</span>
        </h2>

        <form method="GET" className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              name="search"
              defaultValue={search}
              placeholder="Buscar por título, autor ou ISBN..."
              className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <button type="submit" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
            Buscar
          </button>
          {search && (
            <Link href="/meu-espaco/biblioteca" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Limpar
            </Link>
          )}
        </form>

        {livros.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <BookOpen className="size-12 opacity-30" />
            <p>{search ? "Nenhum livro encontrado para a busca." : "Nenhum livro no acervo ainda."}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {livros.map((livro) => {
              const emprestado = livro.emprestimos.length > 0;
              const prazo = livro.emprestimos[0]?.prazoDevolucao;
              const indisponivel = emprestado || !livro.disponivel;
              return (
                <div key={livro.id} className="flex flex-col rounded-xl border bg-card p-4">
                  <div className="flex items-start gap-2">
                    <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{livro.titulo}</p>
                      {livro.autor && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{livro.autor}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {livro.categoria?.nome && (
                      <Badge variant="secondary" className="text-[10px]">{livro.categoria.nome}</Badge>
                    )}
                    {indisponivel ? (
                      <Badge variant="outline" className="gap-1 border-amber-400/50 text-[10px] text-amber-700 dark:text-amber-400">
                        <CircleAlert className="size-3" />
                        {emprestado && prazo
                          ? `Emprestado até ${format(new Date(prazo), "dd/MM", { locale: ptBR })}`
                          : "Indisponível"}
                      </Badge>
                    ) : (
                      <Badge className="gap-1 bg-emerald-600 text-[10px] hover:bg-emerald-600">
                        <CircleCheck className="size-3" /> Disponível
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <Link
                href={catalogoHref({ page: String(Math.max(1, page - 1)) })}
                aria-disabled={page <= 1}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), page <= 1 && "pointer-events-none opacity-50")}
              >
                Anterior
              </Link>
              <Link
                href={catalogoHref({ page: String(Math.min(totalPages, page + 1)) })}
                aria-disabled={page >= totalPages}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), page >= totalPages && "pointer-events-none opacity-50")}
              >
                Próxima
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import { BookOpen, Plus, Search, FileDown } from "lucide-react";
import { getLivros, getCategorias, getStats } from "@/lib/biblioteca/queries";
import { PageHeader } from "@/components/layout/page-header";
import { LivroDisponibilidadeBadge, LivroOrigemBadge } from "@/components/modules/biblioteca/livro-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LivroFilters } from "@/lib/biblioteca/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Biblioteca — CEF" };

interface SearchParams { search?: string; categoriaId?: string; origem?: string; disponivel?: string; page?: string; }

export default async function BibliotecaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const filters: LivroFilters = {
    search: sp.search,
    categoriaId: sp.categoriaId,
    origem: sp.origem,
    disponivel: sp.disponivel,
    page: sp.page ? parseInt(sp.page) : 1,
  };

  const [{ livros, total, page, totalPages }, categorias, stats] = await Promise.all([
    getLivros(filters),
    getCategorias(),
    getStats(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Biblioteca" description="Acervo de livros do CEF">
        <Link href="/biblioteca/novo" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus className="size-4 mr-1" /> Novo livro
        </Link>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total de livros", value: stats.total, color: "text-foreground" },
          { label: "Disponíveis", value: stats.disponiveis, color: "text-green-600" },
          { label: "Emprestados", value: stats.emprestados, color: "text-amber-600" },
          { label: "Atrasados", value: stats.atrasados, color: "text-red-600" },
          { label: "Doações recebidas", value: stats.doacoes, color: "text-amber-700" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <form method="GET" className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            name="search"
            defaultValue={sp.search}
            placeholder="Buscar título, autor, ISBN, tombo..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background"
          />
        </div>
        <select name="categoriaId" defaultValue={sp.categoriaId} className="border rounded-md text-sm px-3 py-2 bg-background">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select name="origem" defaultValue={sp.origem} className="border rounded-md text-sm px-3 py-2 bg-background">
          <option value="">Toda a origem</option>
          <option value="proprio">Próprio</option>
          <option value="doacao">Doação</option>
        </select>
        <select name="disponivel" defaultValue={sp.disponivel} className="border rounded-md text-sm px-3 py-2 bg-background">
          <option value="">Disponibilidade</option>
          <option value="true">Disponíveis</option>
          <option value="false">Emprestados</option>
        </select>
        <button type="submit" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          Filtrar
        </button>
        {(sp.search || sp.categoriaId || sp.origem || sp.disponivel) && (
          <Link href="/biblioteca" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Limpar
          </Link>
        )}
      </form>

      {/* Grid de livros */}
      {livros.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <BookOpen className="size-12 opacity-30" />
          <p>Nenhum livro encontrado.</p>
          <Link href="/biblioteca/novo" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Cadastrar primeiro livro
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{total} livro{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {livros.map((livro) => (
              <Link
                key={livro.id}
                href={`/biblioteca/${livro.id}`}
                className="rounded-xl border bg-card hover:shadow-md transition-shadow overflow-hidden group"
              >
                {/* Capa */}
                <div className="relative aspect-[3/4] bg-emerald-900 flex items-center justify-center">
                  {livro.capaUrl ? (
                    <Image src={livro.capaUrl} alt={livro.titulo} fill className="object-cover" />
                  ) : (
                    <span className="text-5xl font-bold text-white/30 select-none">
                      {livro.titulo.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="p-3 space-y-1.5">
                  <p className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {livro.titulo}
                  </p>
                  {livro.autor && <p className="text-xs text-muted-foreground">{livro.autor}</p>}
                  <div className="flex flex-wrap gap-1 pt-1">
                    <LivroDisponibilidadeBadge disponivel={livro.disponivel} />
                    {livro.origem === "doacao" && (
                      <LivroOrigemBadge origem={livro.origem} doadorNome={livro.doadorNome} />
                    )}
                  </div>
                  {livro.categoria && (
                    <p className="text-xs text-muted-foreground">{livro.categoria.nome}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                const params = new URLSearchParams({ ...sp, page: String(p) });
                return (
                  <Link
                    key={p}
                    href={`/biblioteca?${params}`}
                    className={cn(
                      buttonVariants({ variant: p === page ? "default" : "outline", size: "sm" }),
                    )}
                  >
                    {p}
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import { FileText, Search, ExternalLink, Download, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { requireUser } from "@/lib/authz";
import { getDocumentosParaAssociado } from "@/lib/documentos/queries";
import { driveDownloadUrl, parseTags } from "@/lib/documentos/types";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documentos — Meu Espaço CEF" };

export default async function MeuEspacoDocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  await requireUser();
  const { search } = await searchParams;

  const grupos = await getDocumentosParaAssociado(search);
  const total = grupos.reduce((acc, g) => acc + g.docs.length, 0);

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <PageHeader
        title="Documentos do CEF"
        description="Estatuto, regimento, comunicados e outros documentos oficiais do clube"
      />

      {/* Busca */}
      <form method="GET" className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            name="search"
            defaultValue={search}
            placeholder="Buscar documento..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background"
          />
        </div>
        <button type="submit" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          Buscar
        </button>
        {search && (
          <Link href="/meu-espaco/documentos" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Limpar
          </Link>
        )}
      </form>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <FileText className="size-12 opacity-30" />
          <p>{search ? "Nenhum documento encontrado para a busca." : "Nenhum documento disponível no momento."}</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.map((grupo) => (
            <section key={grupo.categoria} className="space-y-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <FolderOpen className="size-4 text-primary" />
                {grupo.categoria}
                <span className="text-xs font-normal text-muted-foreground">
                  ({grupo.docs.length})
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {grupo.docs.map((doc) => {
                  const tags = parseTags(doc.tags);
                  return (
                    <div key={doc.id} className="rounded-xl border bg-card p-4 space-y-2 flex flex-col">
                      <div className="flex items-start gap-2">
                        <FileText className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm leading-tight">{doc.titulo}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            v{doc.versao} · {format(new Date(doc.publicadoEm), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      {doc.descricao && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{doc.descricao}</p>
                      )}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, 3).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 pt-1 mt-auto">
                        <a
                          href={doc.driveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1")}
                        >
                          <ExternalLink className="size-3.5 mr-1" /> Abrir
                        </a>
                        {doc.permitirDownload && (
                          <a
                            href={driveDownloadUrl(doc.driveUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Baixar documento"
                            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                          >
                            <Download className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

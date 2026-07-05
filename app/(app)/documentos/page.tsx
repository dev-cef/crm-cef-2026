import Link from "next/link";
import { CloudUpload, FileText, Plus, Search, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { getDocumentos, getDocCategorias, getDocStats } from "@/lib/documentos/queries";
import { DOC_NIVEL_LABELS, DOC_STATUS_LABELS, parseTags, type DocumentoFilters } from "@/lib/documentos/types";
import { getDriveConfig, driveOauthConfigured } from "@/lib/google-drive";
import { PageHeader } from "@/components/layout/page-header";
import { DocNivelBadge, DocStatusBadge, DocVencidoBadge } from "@/components/modules/documentos/documento-badges";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documentos — CEF" };

interface SearchParams {
  search?: string;
  categoriaId?: string;
  status?: string;
  nivelAcesso?: string;
  ordenar?: string;
  page?: string;
  drive?: string; // feedback do fluxo de conexão OAuth
}

const DRIVE_FEEDBACK: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: "Google Drive do CEF conectado com sucesso! O upload de arquivos já está disponível." },
  erro_cancelado: { ok: false, text: "Conexão com o Google Drive cancelada." },
  erro_state: { ok: false, text: "Sessão de conexão expirada — tente conectar de novo." },
  erro_sem_refresh_token: { ok: false, text: "O Google não devolveu a autorização completa. Tente de novo (o consentimento precisa ser concluído)." },
  erro_conexao: { ok: false, text: "Falha ao conectar com o Google Drive. Tente novamente." },
  erro_permissao: { ok: false, text: "Somente administradores podem conectar o Google Drive." },
  erro_oauth_nao_configurado: { ok: false, text: "O OAuth do Google não está configurado no servidor (AUTH_GOOGLE_ID/SECRET)." },
};

export default async function DocumentosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await auth();
  const user = toSessionUser(session!.user);

  const filters: DocumentoFilters = {
    search: sp.search,
    categoriaId: sp.categoriaId,
    status: sp.status,
    nivelAcesso: sp.nivelAcesso,
    ordenar: sp.ordenar,
    page: sp.page ? parseInt(sp.page) : 1,
  };

  const [{ documentos, total, page, totalPages }, categorias, stats, canCreate, driveCfg] =
    await Promise.all([
      getDocumentos(filters, user.role),
      getDocCategorias(),
      getDocStats(user.role),
      can(user, "documentos", "create"),
      getDriveConfig(),
    ]);

  const isAdmin = user.role === "ADMIN";
  const driveOk = !!driveCfg.driveRefreshToken && !!driveCfg.driveFolderId;
  const feedback = sp.drive ? DRIVE_FEEDBACK[sp.drive] : null;

  const niveisFiltraveis = user.role === "ADMIN"
    ? (["ASSOCIADOS", "DIRETORIA", "ADMIN"] as const)
    : (["ASSOCIADOS", "DIRETORIA"] as const);

  const temFiltro = sp.search || sp.categoriaId || sp.status || sp.nivelAcesso || sp.ordenar;

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Documentos" description="Documentos oficiais do CEF no Google Drive institucional">
        {canCreate && (
          <Link href="/documentos/novo" className={cn(buttonVariants({ size: "sm" }))}>
            <Plus className="size-4 mr-1" /> Novo documento
          </Link>
        )}
      </PageHeader>

      {/* Feedback do fluxo de conexão do Drive */}
      {feedback && (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-sm",
            feedback.ok
              ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
              : "border-destructive/40 bg-destructive/5 text-destructive",
          )}
        >
          {feedback.text}
        </div>
      )}

      {/* Conexão com o Drive do CEF (upload direto) — visível só pro admin */}
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <CloudUpload className="size-4 text-muted-foreground" />
            {driveOk ? (
              <span>
                Google Drive conectado
                {driveCfg.driveAccountEmail && (
                  <> como <span className="font-medium">{driveCfg.driveAccountEmail}</span></>
                )}{" "}
                — upload direto de arquivos ativado.
              </span>
            ) : (
              <span>
                Conecte o Google Drive do CEF para enviar arquivos direto pelo CRM (sem sair do
                painel).
              </span>
            )}
          </div>
          {driveOauthConfigured() && (
            <a
              href="/api/google-drive/connect"
              className={cn(buttonVariants({ size: "sm", variant: driveOk ? "outline" : "default" }))}
            >
              {driveOk ? "Reconectar" : "Conectar Drive do CEF"}
            </a>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Ativos", value: stats.ativos, color: "text-green-600" },
          { label: "Em revisão", value: stats.emRevisao, color: "text-amber-600" },
          { label: "Arquivados", value: stats.arquivados, color: "text-muted-foreground" },
          { label: "Vencidos", value: stats.vencidos, color: "text-red-600" },
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
            placeholder="Buscar por título, descrição ou palavra-chave..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-md bg-background"
          />
        </div>
        <select name="categoriaId" defaultValue={sp.categoriaId} className="border rounded-md text-sm px-3 py-2 bg-background">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select name="status" defaultValue={sp.status} className="border rounded-md text-sm px-3 py-2 bg-background">
          <option value="">Todos os status</option>
          {Object.entries(DOC_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="nivelAcesso" defaultValue={sp.nivelAcesso} className="border rounded-md text-sm px-3 py-2 bg-background">
          <option value="">Todos os níveis</option>
          {niveisFiltraveis.map((n) => <option key={n} value={n}>{DOC_NIVEL_LABELS[n]}</option>)}
        </select>
        <select name="ordenar" defaultValue={sp.ordenar} className="border rounded-md text-sm px-3 py-2 bg-background">
          <option value="">Mais recentes</option>
          <option value="titulo">Título (A–Z)</option>
        </select>
        <button type="submit" className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
          Filtrar
        </button>
        {temFiltro && (
          <Link href="/documentos" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            Limpar
          </Link>
        )}
      </form>

      {/* Lista */}
      {documentos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <FileText className="size-12 opacity-30" />
          <p>Nenhum documento encontrado.</p>
          {canCreate && (
            <Link href="/documentos/novo" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Cadastrar primeiro documento
            </Link>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {total} documento{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}
          </p>
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left p-3">Documento</th>
                    <th className="text-left p-3">Categoria</th>
                    <th className="text-left p-3">Versão</th>
                    <th className="text-left p-3">Publicação</th>
                    <th className="text-left p-3">Nível</th>
                    <th className="text-left p-3">Status</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {documentos.map((doc) => {
                    const tags = parseTags(doc.tags);
                    return (
                      <tr key={doc.id} className="border-t hover:bg-muted/30">
                        <td className="p-3">
                          <Link href={`/documentos/${doc.id}`} className="font-medium hover:text-primary transition-colors">
                            {doc.titulo}
                          </Link>
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tags.slice(0, 4).map((t) => (
                                <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{doc.categoria?.nome ?? "—"}</td>
                        <td className="p-3 font-mono text-xs">v{doc.versao}</td>
                        <td className="p-3 whitespace-nowrap">
                          {format(new Date(doc.publicadoEm), "dd/MM/yyyy", { locale: ptBR })}
                        </td>
                        <td className="p-3"><DocNivelBadge nivel={doc.nivelAcesso} /></td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            <DocStatusBadge status={doc.status} />
                            <DocVencidoBadge validadeEm={doc.validadeEm} />
                          </div>
                        </td>
                        <td className="p-3">
                          <a
                            href={doc.driveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir no Google Drive"
                            className="inline-flex text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                const params = new URLSearchParams(
                  Object.fromEntries(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v)),
                );
                return (
                  <Link
                    key={p}
                    href={`/documentos?${params}`}
                    className={cn(buttonVariants({ variant: p === page ? "default" : "outline", size: "sm" }))}
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

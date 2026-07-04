import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil, ExternalLink, Download, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { getDocumentoById } from "@/lib/documentos/queries";
import { driveDownloadUrl, parseTags } from "@/lib/documentos/types";
import { PageHeader } from "@/components/layout/page-header";
import { DocNivelBadge, DocStatusBadge, DocVencidoBadge } from "@/components/modules/documentos/documento-badges";
import { DocumentoActions } from "@/components/modules/documentos/documento-actions";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = toSessionUser(session!.user);

  const documento = await getDocumentoById(id, user.role);
  if (!documento) notFound();

  const confidencial = documento.nivelAcesso === "ADMIN";
  const podeGerenciarConfidencial = !confidencial || user.role === "ADMIN";
  const [canEditModule, canDeleteModule] = await Promise.all([
    can(user, "documentos", "edit"),
    can(user, "documentos", "delete"),
  ]);
  const canEdit = canEditModule && podeGerenciarConfidencial;
  const canDelete = canDeleteModule && podeGerenciarConfidencial;

  const tags = parseTags(documento.tags);

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <PageHeader title={documento.titulo}>
        {canEdit && (
          <Link href={`/documentos/${id}/editar`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Pencil className="size-4 mr-1" /> Editar
          </Link>
        )}
        <a
          href={documento.driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <ExternalLink className="size-4 mr-1" /> Abrir no Drive
        </a>
      </PageHeader>

      {/* Cabeçalho */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <div className="flex flex-wrap gap-2">
          <DocStatusBadge status={documento.status} />
          <DocNivelBadge nivel={documento.nivelAcesso} />
          <DocVencidoBadge validadeEm={documento.validadeEm} />
          {documento.categoria && <Badge variant="secondary">{documento.categoria.nome}</Badge>}
        </div>
        {documento.descricao && (
          <p className="text-sm text-muted-foreground">{documento.descricao}</p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {documento.permitirDownload && (
            <a
              href={driveDownloadUrl(documento.driveUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Download className="size-4 mr-1" /> Baixar
            </a>
          )}
          <DocumentoActions
            id={documento.id}
            titulo={documento.titulo}
            status={documento.status}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>
      </div>

      {/* Detalhes */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold mb-4">Detalhes</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <dt className="text-muted-foreground">Versão atual</dt>
          <dd className="sm:col-span-2 font-mono">v{documento.versao}</dd>
          <dt className="text-muted-foreground">Publicado em</dt>
          <dd className="sm:col-span-2">{format(new Date(documento.publicadoEm), "dd/MM/yyyy", { locale: ptBR })}</dd>
          {documento.validadeEm && (
            <>
              <dt className="text-muted-foreground">Válido até</dt>
              <dd className="sm:col-span-2">{format(new Date(documento.validadeEm), "dd/MM/yyyy", { locale: ptBR })}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Download</dt>
          <dd className="sm:col-span-2">{documento.permitirDownload ? "Permitido" : "Somente visualização"}</dd>
          <dt className="text-muted-foreground">Cadastrado por</dt>
          <dd className="sm:col-span-2">
            {documento.criadoPorNome ?? "—"}
            <span className="text-muted-foreground text-xs ml-2">
              {format(new Date(documento.criadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </dd>
          <dt className="text-muted-foreground">Última alteração</dt>
          <dd className="sm:col-span-2">
            {documento.atualizadoPorNome ?? "—"}
            <span className="text-muted-foreground text-xs ml-2">
              {format(new Date(documento.atualizadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </dd>
        </dl>
      </div>

      {/* Histórico de versões */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <History className="size-4" /> Histórico de versões
        </h2>
        {documento.versoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma versão anterior — este documento está na versão original.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left pb-2">Versão</th>
                  <th className="text-left pb-2">Substituída em</th>
                  <th className="text-left pb-2">Por</th>
                  <th className="text-left pb-2">Observação</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {documento.versoes.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 font-mono">v{v.versao}</td>
                    <td className="py-2">{format(new Date(v.criadoEm), "dd/MM/yyyy HH:mm", { locale: ptBR })}</td>
                    <td className="py-2">{v.criadoPorNome ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">{v.observacao ?? "—"}</td>
                    <td className="py-2">
                      <a
                        href={v.driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir versão anterior no Drive"
                        className="inline-flex text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

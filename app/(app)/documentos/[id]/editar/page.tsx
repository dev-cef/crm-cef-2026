import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { getDocumentoById, getDocCategorias } from "@/lib/documentos/queries";
import { parseTags } from "@/lib/documentos/types";
import { driveConnected } from "@/lib/google-drive";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentoForm } from "@/components/modules/documentos/documento-form";
import { atualizarDocumento, type DocumentoFormValues } from "@/app/(app)/documentos/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar documento — CEF" };

export default async function EditarDocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = toSessionUser(session!.user);
  if (!(await can(user, "documentos", "edit"))) redirect(`/documentos/${id}`);

  const [documento, categorias, driveReady] = await Promise.all([
    getDocumentoById(id, user.role),
    getDocCategorias(),
    driveConnected(),
  ]);
  if (!documento) notFound();
  if (documento.nivelAcesso === "ADMIN" && user.role !== "ADMIN") redirect("/documentos");

  const defaultValues: Partial<DocumentoFormValues> = {
    titulo: documento.titulo,
    descricao: documento.descricao ?? undefined,
    categoriaId: documento.categoriaId ?? undefined,
    driveUrl: documento.driveUrl,
    publicadoEm: new Date(documento.publicadoEm).toISOString().slice(0, 10),
    validadeEm: documento.validadeEm
      ? new Date(documento.validadeEm).toISOString().slice(0, 10)
      : undefined,
    versao: documento.versao,
    status: documento.status as DocumentoFormValues["status"],
    nivelAcesso: documento.nivelAcesso as DocumentoFormValues["nivelAcesso"],
    permitirDownload: documento.permitirDownload,
    tags: parseTags(documento.tags).join(", "),
  };

  async function onSubmit(values: DocumentoFormValues) {
    "use server";
    return atualizarDocumento(id, values);
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <PageHeader
        title="Editar documento"
        description="Alterar a versão ou o link do arquivo registra a versão anterior no histórico"
      />
      <DocumentoForm
        defaultValues={defaultValues}
        categorias={categorias}
        isAdmin={user.role === "ADMIN"}
        driveReady={driveReady}
        onSubmit={onSubmit}
        submitLabel="Salvar alterações"
        documentoId={id}
      />
    </div>
  );
}

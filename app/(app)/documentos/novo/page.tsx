import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { getDocCategorias } from "@/lib/documentos/queries";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentoForm } from "@/components/modules/documentos/documento-form";
import { criarDocumento } from "@/app/(app)/documentos/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novo documento — CEF" };

export default async function NovoDocumentoPage() {
  const session = await auth();
  const user = toSessionUser(session!.user);
  if (!(await can(user, "documentos", "create"))) redirect("/documentos");

  const categorias = await getDocCategorias();

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <PageHeader
        title="Novo documento"
        description="Cadastre o link de um documento do Google Drive institucional"
      />
      <DocumentoForm
        categorias={categorias}
        isAdmin={user.role === "ADMIN"}
        onSubmit={criarDocumento}
        submitLabel="Cadastrar documento"
      />
    </div>
  );
}

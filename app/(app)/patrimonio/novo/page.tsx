import { getLocais, getMembros } from "@/lib/patrimonio/queries";
import { PageHeader } from "@/components/layout/page-header";
import { BemForm } from "@/components/modules/patrimonio/bem-form";
import { createBem } from "@/app/(app)/patrimonio/actions";

export const metadata = { title: "Novo bem — Patrimônio CEF" };

export default async function NovoBemPage() {
  const [locais, membros] = await Promise.all([getLocais(), getMembros()]);

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <PageHeader title="Cadastrar bem patrimonial" />
      <BemForm
        locais={locais}
        membros={membros}
        onSubmit={createBem}
        submitLabel="Cadastrar bem"
      />
    </div>
  );
}

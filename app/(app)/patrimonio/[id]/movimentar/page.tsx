import { notFound } from "next/navigation";
import { getBemById, getLocais, getMembros } from "@/lib/patrimonio/queries";
import { PageHeader } from "@/components/layout/page-header";
import { MovimentacaoForm } from "@/components/modules/patrimonio/movimentacao-form";
import { BemStatusBadge } from "@/components/modules/patrimonio/bem-status-badge";

export const metadata = { title: "Registrar movimentação — Patrimônio CEF" };

export default async function MovimentarBemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bem, locais, membros] = await Promise.all([getBemById(id), getLocais(), getMembros()]);
  if (!bem) notFound();

  if (bem.status === "baixado") {
    return (
      <div className="p-6 max-w-xl">
        <PageHeader title="Movimentar bem" />
        <p className="text-muted-foreground mt-4">
          Este bem foi baixado e não pode receber novas movimentações.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-xl">
      <PageHeader title="Registrar movimentação" description={bem.nome} />
      <div className="rounded-xl border bg-card p-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{bem.codigo}</p>
          <p className="font-semibold">{bem.nome}</p>
        </div>
        <BemStatusBadge status={bem.status} />
      </div>
      <MovimentacaoForm bemId={id} locais={locais} membros={membros} />
    </div>
  );
}

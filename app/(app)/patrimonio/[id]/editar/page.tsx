import { notFound } from "next/navigation";
import { getBemById, getLocais, getMembros } from "@/lib/patrimonio/queries";
import { PageHeader } from "@/components/layout/page-header";
import { BemForm } from "@/components/modules/patrimonio/bem-form";
import { updateBem } from "@/app/(app)/patrimonio/actions";
import type { BemFormValues } from "@/app/(app)/patrimonio/actions";

export const metadata = { title: "Editar bem — Patrimônio CEF" };

export default async function EditarBemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bem, locais, membros] = await Promise.all([getBemById(id), getLocais(), getMembros()]);
  if (!bem) notFound();

  const defaultValues: Partial<BemFormValues> = {
    nome: bem.nome,
    categoria: bem.categoria as BemFormValues["categoria"],
    estado: bem.estado as BemFormValues["estado"],
    status: bem.status as BemFormValues["status"],
    descricao: bem.descricao ?? "",
    marca: bem.marca ?? "",
    modelo: bem.modelo ?? "",
    numeroSerie: bem.numeroSerie ?? "",
    localId: bem.localId ?? "",
    responsavelId: bem.responsavelId ?? "",
    valorAquisicao: bem.valorAquisicao ? Number(bem.valorAquisicao) : undefined,
    dataAquisicao: bem.dataAquisicao
      ? new Date(bem.dataAquisicao).toISOString().split("T")[0]
      : "",
    formaAquisicao: (bem.formaAquisicao as BemFormValues["formaAquisicao"]) ?? "propria",
    notaFiscal: bem.notaFiscal ?? "",
    fornecedor: bem.fornecedor ?? "",
    doador: bem.doador ?? "",
    vidaUtilAnos: bem.vidaUtilAnos ?? undefined,
    valorResidual: bem.valorResidual ? Number(bem.valorResidual) : undefined,
    observacoes: bem.observacoes ?? "",
    fotoUrl: bem.fotoUrl ?? "",
  };

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <PageHeader title="Editar bem" description={bem.nome} />
      <BemForm
        defaultValues={defaultValues}
        locais={locais}
        membros={membros}
        onSubmit={(v) => updateBem(id, v)}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { getLivroById, getCategorias, getMembrosAtivos } from "@/lib/biblioteca/queries";
import { PageHeader } from "@/components/layout/page-header";
import { LivroForm } from "@/components/modules/biblioteca/livro-form";
import { atualizarLivro } from "@/app/(app)/biblioteca/actions";
import type { LivroFormValues } from "@/app/(app)/biblioteca/actions";

export const metadata = { title: "Editar livro — Biblioteca CEF" };

export default async function EditarLivroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [livro, categorias, membros] = await Promise.all([
    getLivroById(id),
    getCategorias(),
    getMembrosAtivos(),
  ]);
  if (!livro) notFound();

  const defaultValues: Partial<LivroFormValues> = {
    titulo: livro.titulo,
    autor: livro.autor ?? "",
    editora: livro.editora ?? "",
    anoPublicacao: livro.anoPublicacao ?? undefined,
    isbn: livro.isbn ?? "",
    categoriaId: livro.categoriaId ?? "",
    origem: (livro.origem as LivroFormValues["origem"]) ?? "proprio",
    doadorNome: livro.doadorNome ?? "",
    doadorSocioId: livro.doadorSocioId ?? "",
    estado: (livro.estado as LivroFormValues["estado"]) ?? "otimo",
    descricao: livro.descricao ?? "",
    capaUrl: livro.capaUrl ?? "",
    observacoes: livro.observacoes ?? "",
    numeroTombo: livro.numeroTombo ?? "",
  };

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <PageHeader title="Editar livro" description={livro.titulo} />
      <LivroForm
        defaultValues={defaultValues}
        categorias={categorias}
        membros={membros}
        onSubmit={atualizarLivro.bind(null, id)}
        submitLabel="Salvar alterações"
      />
    </div>
  );
}

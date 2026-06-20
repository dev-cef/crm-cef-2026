import { getCategorias, getMembrosAtivos, gerarNumeroTombo } from "@/lib/biblioteca/queries";
import { PageHeader } from "@/components/layout/page-header";
import { LivroForm } from "@/components/modules/biblioteca/livro-form";
import { criarLivro } from "@/app/(app)/biblioteca/actions";

export const metadata = { title: "Novo livro — Biblioteca CEF" };

export default async function NovoLivroPage() {
  const [categorias, membros, tomboSugerido] = await Promise.all([
    getCategorias(),
    getMembrosAtivos(),
    gerarNumeroTombo(),
  ]);

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <PageHeader title="Novo livro" description="Cadastre um novo livro no acervo" />
      <LivroForm
        categorias={categorias}
        membros={membros}
        tomboSugerido={tomboSugerido}
        onSubmit={criarLivro}
        submitLabel="Cadastrar livro"
      />
    </div>
  );
}

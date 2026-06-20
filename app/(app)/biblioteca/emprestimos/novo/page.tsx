import { getLivros, getMembrosAtivos } from "@/lib/biblioteca/queries";
import { PageHeader } from "@/components/layout/page-header";
import { EmprestimoForm } from "@/components/modules/biblioteca/emprestimo-form";
import { registrarEmprestimo } from "@/app/(app)/biblioteca/actions";

export const metadata = { title: "Novo empréstimo — Biblioteca CEF" };

export default async function NovoEmprestimoPage({ searchParams }: { searchParams: Promise<{ livroId?: string }> }) {
  const sp = await searchParams;

  const [{ livros }, membros] = await Promise.all([
    getLivros({ disponivel: "true" }),
    getMembrosAtivos(),
  ]);

  return (
    <div className="space-y-6 p-6 max-w-xl">
      <PageHeader title="Novo empréstimo" description="Registre um empréstimo de livro" />
      <div className="rounded-xl border bg-card p-6">
        <EmprestimoForm
          livros={livros.map((l) => ({
            id: l.id,
            titulo: l.titulo,
            autor: l.autor,
            numeroTombo: l.numeroTombo,
            disponivel: l.disponivel,
          }))}
          membros={membros}
          defaultLivroId={sp.livroId}
          onSubmit={registrarEmprestimo}
        />
      </div>
    </div>
  );
}

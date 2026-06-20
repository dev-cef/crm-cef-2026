import Link from "next/link";
import { BookMarked, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { differenceInDays } from "date-fns";
import { getEmprestimosAtivos } from "@/lib/biblioteca/queries";
import { PageHeader } from "@/components/layout/page-header";
import { EmprestimoStatusBadge } from "@/components/modules/biblioteca/livro-status-badge";
import { DevolucaoDialog } from "@/components/modules/biblioteca/devolucao-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Empréstimos — Biblioteca CEF" };

export default async function EmprestimosPage() {
  const emprestimos = await getEmprestimosAtivos();
  const atrasados = emprestimos.filter((e) => e.status === "atrasado");
  const ativos = emprestimos.filter((e) => e.status === "ativo");

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Empréstimos" description="Controle de livros emprestados">
        <Link href="/biblioteca/emprestimos/novo" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus className="size-4 mr-1" /> Novo empréstimo
        </Link>
      </PageHeader>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Empréstimos ativos", value: ativos.length, color: "text-blue-600" },
          { label: "Atrasados", value: atrasados.length, color: "text-red-600" },
          { label: "Total em circulação", value: emprestimos.length, color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {emprestimos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <BookMarked className="size-12 opacity-30" />
          <p>Nenhum empréstimo ativo no momento.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left p-3">Livro</th>
                <th className="text-left p-3">Sócio</th>
                <th className="text-left p-3">Retirado</th>
                <th className="text-left p-3">Prazo</th>
                <th className="text-left p-3">Dias</th>
                <th className="text-left p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {emprestimos.map((e) => {
                const diasRestantes = differenceInDays(new Date(e.prazoDevolucao), new Date());
                const isAtrasado = e.status === "atrasado";
                return (
                  <tr
                    key={e.id}
                    className={cn(
                      "border-t hover:bg-muted/30 transition-colors",
                      isAtrasado && "bg-red-50/50 dark:bg-red-950/10 border-l-2 border-l-red-500",
                    )}
                  >
                    <td className="p-3">
                      <Link href={`/biblioteca/${e.livroId}`} className="hover:underline font-medium">
                        {e.livro.titulo}
                      </Link>
                      {e.livro.numeroTombo && (
                        <span className="ml-2 text-xs text-muted-foreground font-mono">({e.livro.numeroTombo})</span>
                      )}
                    </td>
                    <td className="p-3">{e.socio.fullName}</td>
                    <td className="p-3 text-muted-foreground">
                      {format(new Date(e.retiradoEm), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {format(new Date(e.prazoDevolucao), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="p-3">
                      <span className={cn(
                        "font-medium",
                        diasRestantes < 0 ? "text-red-600" : diasRestantes <= 3 ? "text-amber-600" : "text-green-600",
                      )}>
                        {diasRestantes > 0 ? `+${diasRestantes}` : diasRestantes}d
                      </span>
                    </td>
                    <td className="p-3"><EmprestimoStatusBadge status={e.status} /></td>
                    <td className="p-3">
                      <DevolucaoDialog
                        emprestimoId={e.id}
                        livroTitulo={e.livro.titulo}
                        socioNome={e.socio.fullName}
                        prazoDevolucao={new Date(e.prazoDevolucao)}
                        estadoRetirada={e.estadoRetirada}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

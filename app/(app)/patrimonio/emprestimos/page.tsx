import Link from "next/link";
import { HandshakeIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { differenceInDays } from "date-fns";
import { getEmprestimosAtivos } from "@/lib/patrimonio/queries";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Empréstimos — Patrimônio CEF" };

export default async function EmprestimosPatrimonioPage() {
  const bens = await getEmprestimosAtivos();
  const hoje = new Date();

  const atrasados = bens.filter((b) => {
    const mov = b.movimentacoes[0];
    return mov?.dataDevolucaoPrevista && new Date(mov.dataDevolucaoPrevista) < hoje;
  });

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Empréstimos" description="Equipamentos atualmente emprestados" />

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Empréstimos ativos", value: bens.length, color: "text-blue-600" },
          { label: "Atrasados", value: atrasados.length, color: "text-red-600" },
          { label: "Total em campo", value: bens.length, color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {bens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <HandshakeIcon className="size-12 opacity-30" />
          <p>Nenhum equipamento emprestado no momento.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-xs text-muted-foreground">
                <th className="text-left p-3">Código</th>
                <th className="text-left p-3">Equipamento</th>
                <th className="text-left p-3">Responsável</th>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Prazo</th>
                <th className="text-left p-3">Dias</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {bens.map((b) => {
                const mov = b.movimentacoes[0];
                const prazo = mov?.dataDevolucaoPrevista ? new Date(mov.dataDevolucaoPrevista) : null;
                const diasRestantes = prazo ? differenceInDays(prazo, hoje) : null;
                const isAtrasado = diasRestantes !== null && diasRestantes < 0;
                const responsavel = b.responsavel ?? mov?.responsavel ?? null;

                return (
                  <tr
                    key={b.id}
                    className={cn(
                      "border-t hover:bg-muted/30 transition-colors",
                      isAtrasado && "bg-red-50/50 dark:bg-red-950/10 border-l-2 border-l-red-500",
                    )}
                  >
                    <td className="p-3 font-mono text-xs text-muted-foreground">{b.codigo}</td>
                    <td className="p-3">
                      <Link href={`/patrimonio/${b.id}`} className="hover:underline font-medium">
                        {b.nome}
                      </Link>
                    </td>
                    <td className="p-3">{responsavel?.fullName ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">
                      {mov?.data ? format(new Date(mov.data), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {prazo ? format(prazo, "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </td>
                    <td className="p-3">
                      {diasRestantes !== null ? (
                        <span className={cn(
                          "font-medium",
                          diasRestantes < 0 ? "text-red-600" : diasRestantes <= 3 ? "text-amber-600" : "text-green-600",
                        )}>
                          {diasRestantes > 0 ? `+${diasRestantes}` : diasRestantes}d
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/patrimonio/${b.id}/movimentar`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Registrar devolução
                      </Link>
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

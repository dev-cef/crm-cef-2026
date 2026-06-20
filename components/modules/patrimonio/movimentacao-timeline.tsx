import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeftRight,
  ArrowUpFromLine,
  ArrowDownToLine,
  Wrench,
  RotateCcw,
  HandshakeIcon,
  Trash2,
} from "lucide-react";
import { MOVIMENTACAO_LABELS, type MovimentacaoTipo } from "@/lib/patrimonio/types";
import type { MovimentacaoComRelacoes } from "@/lib/patrimonio/types";

const TIPO_ICON: Record<MovimentacaoTipo, React.ElementType> = {
  entrada: ArrowDownToLine,
  transferencia: ArrowLeftRight,
  emprestimo: HandshakeIcon,
  devolucao: ArrowUpFromLine,
  manutencao: Wrench,
  retorno_manutencao: RotateCcw,
  baixa: Trash2,
};

const TIPO_COLOR: Record<MovimentacaoTipo, string> = {
  entrada: "bg-emerald-100 text-emerald-700",
  transferencia: "bg-blue-100 text-blue-700",
  emprestimo: "bg-amber-100 text-amber-700",
  devolucao: "bg-emerald-100 text-emerald-700",
  manutencao: "bg-orange-100 text-orange-700",
  retorno_manutencao: "bg-sky-100 text-sky-700",
  baixa: "bg-red-100 text-red-700",
};

export function MovimentacaoTimeline({ movimentacoes }: { movimentacoes: MovimentacaoComRelacoes[] }) {
  if (movimentacoes.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>;
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-6">
      {movimentacoes.map((m) => {
        const tipo = m.tipo as MovimentacaoTipo;
        const Icon = TIPO_ICON[tipo] ?? ArrowLeftRight;
        const colorClass = TIPO_COLOR[tipo] ?? "bg-gray-100 text-gray-700";

        return (
          <li key={m.id} className="ml-6">
            <span
              className={`absolute -left-3 flex size-6 items-center justify-center rounded-full ${colorClass}`}
            >
              <Icon className="size-3" />
            </span>
            <div className="rounded-lg border bg-card p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{MOVIMENTACAO_LABELS[tipo]}</p>
                <time className="text-xs text-muted-foreground">
                  {format(new Date(m.data), "dd/MM/yyyy", { locale: ptBR })}
                </time>
              </div>
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {m.localOrigem && <p>Origem: {m.localOrigem.nome}</p>}
                {m.localDestino && <p>Destino: {m.localDestino.nome}</p>}
                {m.responsavel && <p>Responsável: {m.responsavel.fullName}</p>}
                {m.dataDevolucaoPrevista && (
                  <p>
                    Devolução prevista:{" "}
                    {format(new Date(m.dataDevolucaoPrevista), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
                {m.dataDevolucaoReal && (
                  <p>
                    Devolvido em:{" "}
                    {format(new Date(m.dataDevolucaoReal), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
                {m.observacoes && <p className="mt-1 italic">{m.observacoes}</p>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

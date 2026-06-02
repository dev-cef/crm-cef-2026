"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ReceitaMensal {
  label: string; // "Jan/26"
  arrecadado: number; // R$ pagos no mês
  aReceber: number;   // R$ pendente + atrasado
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function ReceitaChart({ data }: { data: ReceitaMensal[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum dado de receita encontrado.
      </p>
    );
  }

  const maxTotal = Math.max(
    ...data.map((d) => d.arrecadado + d.aReceber),
    1,
  );
  const BAR_H = 180;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {[
          { color: "bg-primary", label: "Arrecadado" },
          { color: "bg-primary/20 border border-primary/30", label: "A receber" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={cn("inline-block size-2.5 rounded-sm", l.color)} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Bars */}
      <div className="flex items-end gap-2 sm:gap-3">
        {data.map((d, i) => {
          const total = d.arrecadado + d.aReceber;
          const arrecH = total > 0 ? (d.arrecadado / maxTotal) * BAR_H : 0;
          const recebH = total > 0 ? (d.aReceber / maxTotal) * BAR_H : 0;
          const isHovered = hovered === i;
          const taxaRecebimento =
            total > 0 ? Math.round((d.arrecadado / total) * 100) : null;

          return (
            <div
              key={d.label}
              className="group relative flex flex-1 flex-col items-center gap-1"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip */}
              {isHovered && total > 0 && (
                <div className="absolute bottom-full mb-2 z-10 w-40 rounded-lg border bg-popover p-2 text-xs shadow-md">
                  <p className="mb-1 font-semibold">{d.label}</p>
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-primary">Arrecadado</span>
                      <span className="font-medium">R$ {formatBRL(d.arrecadado)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">A receber</span>
                      <span>R$ {formatBRL(d.aReceber)}</span>
                    </div>
                    <div className="mt-1 flex justify-between border-t pt-1 font-medium">
                      <span>Total</span>
                      <span>R$ {formatBRL(total)}</span>
                    </div>
                    {taxaRecebimento !== null && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Recebimento</span>
                        <span
                          className={cn(
                            taxaRecebimento >= 80
                              ? "text-green-600"
                              : taxaRecebimento >= 50
                                ? "text-amber-500"
                                : "text-red-500",
                          )}
                        >
                          {taxaRecebimento}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Value label above bar */}
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                {total > 0 ? `R$ ${formatBRL(d.arrecadado)}` : "—"}
              </span>

              {/* Stacked bar */}
              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-sm"
                style={{ height: BAR_H }}
              >
                {/* Arrecadado — bottom (solid) */}
                <div
                  className="w-full shrink-0 bg-primary transition-all duration-500"
                  style={{ height: arrecH }}
                />
                {/* A receber — top (faded) */}
                <div
                  className="w-full shrink-0 border border-primary/20 bg-primary/15 transition-all duration-500"
                  style={{ height: recebH }}
                />
              </div>

              {/* Month label */}
              <span className="text-[10px] font-medium text-muted-foreground">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Passe o mouse sobre as barras para ver o detalhe por mês.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface MonthStat {
  label: string; // "Jan/26"
  pago: number;
  pendente: number;
  atrasado: number;
}

export function InadimplenciaChart({ data }: { data: MonthStat[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum dado de pagamento encontrado.
      </p>
    );
  }

  const maxTotal = Math.max(...data.map((d) => d.pago + d.pendente + d.atrasado), 1);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {[
          { color: "bg-green-500", label: "Pago" },
          { color: "bg-amber-400", label: "Pendente" },
          { color: "bg-red-500", label: "Atrasado" },
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
          const total = d.pago + d.pendente + d.atrasado;
          const inadRate = total > 0 ? Math.round((d.atrasado / total) * 100) : 0;
          const isHovered = hovered === i;

          const pagoH = total > 0 ? (d.pago / maxTotal) * 180 : 0;
          const pendH = total > 0 ? (d.pendente / maxTotal) * 180 : 0;
          const atrasH = total > 0 ? (d.atrasado / maxTotal) * 180 : 0;

          return (
            <div
              key={d.label}
              className="group relative flex flex-1 flex-col items-center gap-1"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip */}
              {isHovered && total > 0 && (
                <div className="absolute bottom-full mb-2 z-10 w-36 rounded-lg border bg-popover p-2 text-xs shadow-md">
                  <p className="mb-1 font-semibold">{d.label}</p>
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-green-600">Pago</span>
                      <span>{d.pago}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-600">Pendente</span>
                      <span>{d.pendente}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-500">Atrasado</span>
                      <span>{d.atrasado}</span>
                    </div>
                    <div className="mt-1 flex justify-between border-t pt-1 font-medium">
                      <span>Inadimplência</span>
                      <span className={inadRate > 20 ? "text-red-500" : inadRate > 10 ? "text-amber-600" : "text-green-600"}>
                        {inadRate}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Rate badge above bar */}
              <span
                className={cn(
                  "text-[10px] font-semibold tabular-nums",
                  inadRate > 20 ? "text-red-500" : inadRate > 10 ? "text-amber-500" : "text-green-600",
                )}
              >
                {total > 0 ? `${inadRate}%` : "—"}
              </span>

              {/* Stacked bar */}
              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-sm transition-opacity"
                style={{ height: 180 }}
              >
                {/* PAGO — bottom */}
                <div
                  className="w-full shrink-0 bg-green-500 transition-all duration-500"
                  style={{ height: pagoH }}
                />
                {/* PENDENTE — middle */}
                <div
                  className="w-full shrink-0 bg-amber-400 transition-all duration-500"
                  style={{ height: pendH }}
                />
                {/* ATRASADO — top */}
                <div
                  className="w-full shrink-0 bg-red-500 transition-all duration-500"
                  style={{ height: atrasH }}
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

      {/* Summary line */}
      <p className="text-xs text-muted-foreground">
        Passe o mouse sobre as barras para ver o detalhe por mês.
      </p>
    </div>
  );
}

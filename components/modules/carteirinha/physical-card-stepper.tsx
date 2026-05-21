"use client";

import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import {
  STAGE_LABELS,
  getStageOrder,
  stageIndex,
  type PhysicalCardStage,
} from "@/lib/physical-card";

type HistoryEntry = {
  toStage: string;
  changedAt: Date | string;
  changedBy: string;
};

export function PhysicalCardStepper({
  currentStage,
  history,
  requestType = "PRIMEIRA_VIA",
}: {
  currentStage: PhysicalCardStage;
  history: HistoryEntry[];
  requestType?: string;
}) {
  const stageOrder = getStageOrder(requestType);
  const isRejected = currentStage === "rejected";
  const activeIdx = isRejected ? -1 : stageIndex(currentStage, requestType);

  function dateFor(stage: PhysicalCardStage): string | null {
    const entry = history.find((h) => h.toStage === stage);
    if (!entry) return null;
    return new Date(entry.changedAt).toLocaleDateString("pt-BR");
  }

  return (
    <div className="w-full">
      {/* Desktop — horizontal */}
      <ol className="hidden items-start md:flex" aria-label="Etapas da solicitação">
        {stageOrder.map((stage, idx) => {
          const done = !isRejected && activeIdx > idx;
          const active = !isRejected && activeIdx === idx;
          const date = dateFor(stage);

          return (
            <li
              key={stage}
              className="relative flex flex-1 flex-col items-center gap-1"
              aria-current={active ? "step" : undefined}
            >
              {/* Connector line */}
              {idx > 0 && (
                <span
                  className={cn(
                    "absolute left-0 right-1/2 top-4 h-0.5 -translate-y-1/2",
                    done || active ? "bg-primary" : "bg-border",
                  )}
                />
              )}
              {idx < stageOrder.length - 1 && (
                <span
                  className={cn(
                    "absolute left-1/2 right-0 top-4 h-0.5 -translate-y-1/2",
                    done ? "bg-primary" : "bg-border",
                  )}
                />
              )}

              {/* Circle */}
              <span
                className={cn(
                  "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : active
                      ? "border-primary bg-background text-primary"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? <Check className="size-4" /> : idx + 1}
              </span>

              <span
                className={cn(
                  "mt-1 text-center text-[11px] leading-tight",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {STAGE_LABELS[stage]}
              </span>
              {date && (
                <span className="text-[10px] text-muted-foreground">{date}</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Rejected state */}
      {isRejected && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3">
          <X className="size-5 shrink-0 text-destructive" />
          <span className="text-sm font-medium text-destructive">Solicitação reprovada</span>
        </div>
      )}

      {/* Mobile — vertical */}
      {!isRejected && (
        <ol className="flex flex-col gap-3 md:hidden">
          {stageOrder.map((stage, idx) => {
            const done = activeIdx > idx;
            const active = activeIdx === idx;
            const date = dateFor(stage);

            return (
              <li key={stage} className="flex items-start gap-3" aria-current={active ? "step" : undefined}>
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : active
                        ? "border-primary bg-background text-primary"
                        : "border-border bg-background text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : idx + 1}
                </span>
                <div className="pt-0.5">
                  <p
                    className={cn(
                      "text-sm",
                      active ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {STAGE_LABELS[stage]}
                  </p>
                  {date && <p className="text-xs text-muted-foreground">{date}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

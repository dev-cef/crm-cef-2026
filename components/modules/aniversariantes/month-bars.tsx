import { cn } from "@/lib/utils";
import { CountUp } from "@/components/unlumen-ui/count-up";

const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function MonthBars({
  counts,
  activeMonth,
}: {
  counts: number[];
  activeMonth?: number;
}) {
  const max = counts.reduce((m, n) => Math.max(m, n), 0);

  return (
    <div className="flex items-end gap-1.5 sm:gap-2">
      {counts.map((n, i) => {
        const active = activeMonth === i + 1;
        const h = max ? (n / max) * 100 : 0;
        return (
          <div
            key={i}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <span className="text-xs font-semibold tabular-nums">
              <CountUp to={n} duration={1} digitEffect="none" />
            </span>
            <div className="flex h-32 w-full items-end">
              <div
                className="bar-grow-v w-full rounded-md"
                style={
                  {
                    "--bar-h": `${n > 0 ? Math.max(h, 4) : 0}%`,
                    "--i": i,
                    background: active
                      ? "var(--primary)"
                      : "color-mix(in oklab, var(--primary) 30%, transparent)",
                  } as React.CSSProperties
                }
              />
            </div>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wide",
                active
                  ? "font-semibold text-primary"
                  : "text-muted-foreground",
              )}
            >
              {MONTHS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

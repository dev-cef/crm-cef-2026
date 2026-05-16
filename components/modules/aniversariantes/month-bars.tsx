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

// ciclo de 6 cores (igual ao anexo)
const PALETTE = [
  "#56b3d9",
  "#5fc9b3",
  "#dfae3c",
  "#e8804f",
  "#e983b9",
  "#a78bda",
];

export function MonthBars({ counts }: { counts: number[] }) {
  const max = counts.reduce((m, n) => Math.max(m, n), 0);

  return (
    <div className="flex items-end gap-1.5 sm:gap-2">
      {counts.map((n, i) => {
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
                    background: PALETTE[i % PALETTE.length],
                  } as React.CSSProperties
                }
              />
            </div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {MONTHS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

import { CountUp } from "@/components/unlumen-ui/count-up";

const COLORS: Record<number, string> = {
  0: "#8a9aa5",
  10: "#7c9fd6",
  20: "#a78bda",
  30: "#56b3d9",
  40: "#dfae3c",
  50: "#e8804f",
  60: "#e983b9",
  70: "#5fc9b3",
  80: "#9bb0a4",
  90: "#8a9aa5",
};
const DEFAULT_COLOR = "#8a9aa5";

export function AgeBars({
  bands,
}: {
  bands: { decade: number; count: number }[];
}) {
  const total = bands.reduce((s, b) => s + b.count, 0);
  const max = bands.reduce((m, b) => Math.max(m, b.count), 0);

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum associado ativo para exibir.
      </p>
    );
  }

  return (
    <div className="space-y-3.5">
      {bands.map((b, i) => {
        const color = COLORS[b.decade] ?? DEFAULT_COLOR;
        const pct = Math.round((b.count / total) * 100);
        const barW = max ? (b.count / max) * 100 : 0;
        return (
          <div key={b.decade} className="flex items-center gap-3">
            <span className="w-9 shrink-0 text-sm text-muted-foreground">
              {b.decade}s
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted-foreground/15">
              <div
                className="bar-grow h-full rounded-full"
                style={
                  {
                    "--bar-w": `${Math.max(barW, 2)}%`,
                    "--i": i,
                    background: color,
                  } as React.CSSProperties
                }
              />
            </div>
            <span className="w-12 shrink-0 text-right leading-tight">
              <span className="font-display text-sm font-semibold tabular-nums">
                <CountUp to={b.count} duration={1.1} digitEffect="none" />
              </span>
              <span className="block text-[11px] text-muted-foreground">
                {pct}%
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

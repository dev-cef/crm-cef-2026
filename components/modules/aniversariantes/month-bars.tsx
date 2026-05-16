import Link from "next/link";
import { CountUp } from "@/components/unlumen-ui/count-up";

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const PALETTE = ["#56b3d9","#5fc9b3","#dfae3c","#e8804f","#e983b9","#a78bda"];

export function MonthBars({
  counts,
  activeMonth,
  buildHref,
}: {
  counts: number[];
  activeMonth?: number; // 1-indexed
  buildHref?: (month: number) => string;
}) {
  const max = counts.reduce((m, n) => Math.max(m, n), 0);

  return (
    <div className="flex items-end gap-1.5 sm:gap-2">
      {counts.map((n, i) => {
        const h = max ? (n / max) * 100 : 0;
        const isActive = activeMonth === i + 1;
        const color = PALETTE[i % PALETTE.length];
        const href = buildHref?.(i + 1);

        const inner = (
          <>
            <span className="text-xs font-semibold tabular-nums">
              <CountUp to={n} duration={1} digitEffect="none" />
            </span>
            <div className="flex h-32 w-full items-end">
              <div
                className="bar-grow-v w-full rounded-md transition-opacity"
                style={{
                  "--bar-h": `${n > 0 ? Math.max(h, 4) : 0}%`,
                  "--i": i,
                  background: color,
                  opacity: activeMonth && !isActive ? 0.35 : 1,
                  outline: isActive ? `2px solid ${color}` : "none",
                  outlineOffset: "2px",
                } as React.CSSProperties}
              />
            </div>
            <span
              className="text-[10px] uppercase tracking-wide"
              style={{ color: isActive ? color : undefined }}
            >
              {MONTHS[i]}
            </span>
          </>
        );

        const cls = "flex min-w-0 flex-1 flex-col items-center gap-1.5";

        return href ? (
          <Link key={i} href={href} className={`${cls} relative z-20 cursor-pointer`} title={`Filtrar por ${MONTHS[i]}`}>
            {inner}
          </Link>
        ) : (
          <div key={i} className={cls}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

type Bar = { label: string; value: number };

const COLOR_RECENT = "hsl(var(--primary))";
const COLOR_OLD = "hsl(var(--primary) / 0.35)";

function fmt(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value)}`;
}

export function RevenueBars({ bars }: { bars: Bar[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const els = ref.current?.querySelectorAll<HTMLElement>("[data-bar]");
    els?.forEach((el, i) => {
      const h = el.dataset.bar ?? "0";
      el.style.setProperty("--bar-h", `${h}%`);
      el.style.setProperty("--i", String(i));
    });
  }, [bars]);

  const max = Math.max(...bars.map((b) => b.value), 1);

  if (bars.every((b) => b.value === 0)) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sem receita registrada nos últimos 6 meses.
      </p>
    );
  }

  return (
    <div ref={ref} className="flex h-40 items-end justify-between gap-1.5">
      {bars.map((b, i) => {
        const pct = (b.value / max) * 100;
        const isRecent = i === bars.length - 1;
        return (
          <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
            {b.value > 0 && (
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                R${fmt(b.value)}
              </span>
            )}
            <div className="flex w-full flex-1 flex-col justify-end">
              <div
                data-bar={pct < 4 && b.value > 0 ? 4 : pct}
                className="bar-grow-v w-full rounded-t-md"
                style={{
                  background: isRecent ? COLOR_RECENT : COLOR_OLD,
                  height: 0,
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{b.label}</span>
          </div>
        );
      })}
    </div>
  );
}

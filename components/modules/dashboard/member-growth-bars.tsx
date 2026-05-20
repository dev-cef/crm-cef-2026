"use client";

import { useEffect, useRef } from "react";
import { CountUp } from "@/components/unlumen-ui/count-up";

type Bar = { label: string; value: number };

const COLOR_RECENT = "#56b3d9";
const COLOR_OLD = "rgba(86,179,217,0.3)";

export function MemberGrowthBars({ bars }: { bars: Bar[] }) {
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
  const total = bars.reduce((s, b) => s + b.value, 0);

  return (
    <div className="space-y-4">
      <div ref={ref} className="flex h-32 items-end justify-between gap-1.5">
        {bars.map((b, i) => {
          const pct = (b.value / max) * 100;
          const isRecent = i === bars.length - 1;
          return (
            <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
              {b.value > 0 && (
                <span className="text-[10px] font-medium tabular-nums" style={{ color: isRecent ? COLOR_RECENT : "inherit" }}>
                  {b.value}
                </span>
              )}
              <div className="flex w-full flex-1 flex-col justify-end">
                <div
                  data-bar={pct < 6 && b.value > 0 ? 6 : pct}
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
      <p className="text-xs text-muted-foreground text-center">
        Total no período:{" "}
        <strong className="text-foreground">
          <CountUp to={total} duration={1.1} digitEffect="none" />
        </strong>{" "}
        novo{total !== 1 ? "s" : ""} associado{total !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

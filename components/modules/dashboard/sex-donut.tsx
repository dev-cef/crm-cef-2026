import { CountUp } from "@/components/unlumen-ui/count-up";

const FEMALE = "#e983b9";
const MALE = "#56b3d9";
const RATIO = "#dfae3c";

export function SexDonut({
  female,
  male,
}: {
  female: number;
  male: number;
}) {
  const total = female + male;
  const femalePct = total ? Math.round((female / total) * 100) : 0;
  const malePct = total ? 100 - femalePct : 0;
  const ratio = male ? female / male : 0;

  const size = 132;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // pequeno respiro visual entre os segmentos quando há ambos os sexos
  const gap = female && male ? 0.018 * c : 0;
  const fLen = total ? (female / total) * c : 0;
  const mLen = total ? (male / total) * c : 0;

  return (
    <div className="flex items-center gap-6">
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="currentColor"
              className="text-muted-foreground/15"
            />
            {total > 0 && (
              <>
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={FEMALE}
                  strokeDasharray={`${Math.max(fLen - gap, 0.01)} ${c}`}
                />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={MALE}
                  strokeDasharray={`${Math.max(mLen - gap, 0.01)} ${c}`}
                  strokeDashoffset={-fLen}
                />
              </>
            )}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-semibold tabular-nums">
            <CountUp to={total} duration={1.2} digitEffect="none" />
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            ativos
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <LegendRow
          color={FEMALE}
          label="Feminino"
          value={female}
          pct={femalePct}
        />
        <LegendRow
          color={MALE}
          label="Masculino"
          value={male}
          pct={malePct}
        />
        <div className="border-t pt-2.5 text-xs text-muted-foreground">
          Razão F/M{" "}
          <span
            className="ml-1 font-semibold tabular-nums"
            style={{ color: RATIO }}
          >
            {male ? ratio.toFixed(2) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  value,
  pct,
}: {
  color: string;
  label: string;
  value: number;
  pct: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm">
        <span
          className="size-2.5 rounded-full"
          style={{ background: color }}
        />
        {label}
      </span>
      <span className="text-right leading-tight">
        <span
          className="font-display text-xl font-semibold tabular-nums"
          style={{ color }}
        >
          <CountUp to={value} duration={1.2} digitEffect="none" />
        </span>
        <span className="block text-[11px]" style={{ color }}>
          {pct}%
        </span>
      </span>
    </div>
  );
}

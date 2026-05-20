import { CountUp } from "@/components/unlumen-ui/count-up";

const COLORS = {
  PAGO: "#22c55e",
  PENDENTE: "#dfae3c",
  ATRASADO: "#ef4444",
} as const;

const LABELS = {
  PAGO: "Pago",
  PENDENTE: "Pendente",
  ATRASADO: "Atrasado",
} as const;

type Status = keyof typeof COLORS;

export function PaymentStatusDonut({
  pago,
  pendente,
  atrasado,
}: {
  pago: number;
  pendente: number;
  atrasado: number;
}) {
  const items: { key: Status; value: number }[] = [
    { key: "PAGO", value: pago },
    { key: "PENDENTE", value: pendente },
    { key: "ATRASADO", value: atrasado },
  ];
  const total = pago + pendente + atrasado;

  const size = 100;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = total > 0 ? 0.015 * c : 0;

  let offset = 0;
  const arcs = items.map(({ key, value }) => {
    const len = total ? (value / total) * c : 0;
    const arc = { key, value, len, offset };
    offset += len;
    return arc;
  });

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
          >
            <circle
              cx={size / 2} cy={size / 2} r={r}
              stroke="currentColor"
              className="text-muted-foreground/15"
            />
            {total > 0 && arcs.map(({ key, value, len, offset: off }) =>
              value > 0 ? (
                <circle
                  key={key}
                  cx={size / 2} cy={size / 2} r={r}
                  stroke={COLORS[key]}
                  strokeDasharray={`${Math.max(len - gap, 0.01)} ${c}`}
                  strokeDashoffset={-off}
                />
              ) : null
            )}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-lg font-semibold tabular-nums">
            <CountUp to={total} duration={1.2} digitEffect="none" />
          </span>
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
            cobranças
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {items.map(({ key, value }) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-full" style={{ background: COLORS[key] }} />
              {LABELS[key]}
            </span>
            <span
              className="font-display text-sm font-semibold tabular-nums"
              style={{ color: COLORS[key] }}
            >
              <CountUp to={value} duration={1.1} digitEffect="none" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

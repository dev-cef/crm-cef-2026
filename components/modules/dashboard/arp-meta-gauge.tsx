import { CountUp } from "@/components/unlumen-ui/count-up";
import type { MetaArpStatus } from "@/lib/events/arp";

const STATUS_COLORS: Record<MetaArpStatus, string> = {
  abaixo: "#d97706",
  em_risco: "#ea580c",
  atingida: "#16a34a",
};

const STATUS_LABELS: Record<MetaArpStatus, string> = {
  abaixo: "Abaixo da meta",
  em_risco: "Em risco",
  atingida: "Meta atingida",
};

export function ArpMetaGauge({
  meta,
  realizados,
  percentual,
  excedente,
  status,
  ano,
}: {
  meta: number;
  realizados: number;
  percentual: number;
  excedente: number;
  status: MetaArpStatus;
  ano: number;
}) {
  const size = 110;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Barra preenche até 100% do anel. Excedente é destacado em texto, não no arco.
  const pct = Math.min(100, percentual);
  const len = (pct / 100) * c;
  const color = STATUS_COLORS[status];

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
        role="meter"
        aria-valuenow={realizados}
        aria-valuemin={0}
        aria-valuemax={meta}
        aria-label={`Contrapartida ARP ${ano}: ${realizados} de ${meta}`}
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
            {realizados > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={color}
                strokeDasharray={`${len} ${c}`}
              />
            )}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display text-2xl font-semibold tabular-nums"
            style={{ color }}
          >
            <CountUp to={Math.round(percentual)} duration={1.2} digitEffect="none" />%
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {realizados} / {meta}
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className="size-2 rounded-full"
            style={{ background: color }}
          />
          <span className="font-medium" style={{ color }}>
            {STATUS_LABELS[status]}
          </span>
        </div>

        {excedente > 0 ? (
          <p className="text-xs font-medium text-emerald-600">
            ↑ {excedente} {excedente === 1 ? "evento" : "eventos"} acima da meta
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Faltam {Math.max(0, meta - realizados)} para atingir a meta de {meta}
          </p>
        )}

        <p className="pt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          Altos Papos + CEF Cine Montanha · {ano}
        </p>
      </div>
    </div>
  );
}

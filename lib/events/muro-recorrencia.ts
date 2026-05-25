import {
  ARP_COUNTERPART_CODES,
  type EventCategoryValue,
} from "@/lib/constants";

// Categorias que bloqueiam a recorrência do Muro nas quintas-feiras (R4).
// Quando há um desses eventos numa quinta, o muro não é agendado.
export const MURO_THURSDAY_BLOCKERS: readonly EventCategoryValue[] = [
  ...ARP_COUNTERPART_CODES, // altos_papos, cef_cine_montanha
  "aniversario_cef",
  "confraternizacao",
] as const;

// ISO weekday: 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb, 7=Dom.
const MURO_DEFAULT_WEEKDAYS = [1, 3, 4] as const;
const MURO_DEFAULT_HOUR = 19; // 19h00 (horário usual de muro à noite)

export interface MuroOcorrencia {
  date: Date;
  weekday: number; // 1..7
  skipped: boolean; // true = quinta bloqueada por evento concorrente
  skipReason?: string;
}

function isoWeekday(d: Date): number {
  // JS: 0=Dom..6=Sáb → ISO: 1=Seg..7=Dom
  const jsDow = d.getDay();
  return jsDow === 0 ? 7 : jsDow;
}

/**
 * Lista datas candidatas (Seg, Qua, Qui) em um intervalo [start, end).
 * Não consulta o banco — apenas gera o calendário. R4 aplica-se depois com
 * o set de datas-quinta que estão bloqueadas.
 */
export function listarDatasMuro(
  start: Date,
  end: Date,
  thursdayBlockedDates: ReadonlySet<string> = new Set(),
  hour: number = MURO_DEFAULT_HOUR,
): MuroOcorrencia[] {
  const out: MuroOcorrencia[] = [];
  const cur = new Date(start);
  cur.setHours(hour, 0, 0, 0);

  while (cur < end) {
    const wd = isoWeekday(cur);
    if ((MURO_DEFAULT_WEEKDAYS as readonly number[]).includes(wd)) {
      const dateKey = ymd(cur);
      const isThursday = wd === 4;
      const blocked = isThursday && thursdayBlockedDates.has(dateKey);
      out.push({
        date: new Date(cur),
        weekday: wd,
        skipped: blocked,
        skipReason: blocked
          ? "Quinta bloqueada por evento social/ARP concorrente"
          : undefined,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }

  return out;
}

/** YYYY-MM-DD em horário local — usado como chave de set para comparar dias. */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Intervalo [primeiro dia do mês, primeiro dia do próximo mês). */
export function intervaloMes(ano: number, mes1a12: number): {
  start: Date;
  end: Date;
} {
  const start = new Date(ano, mes1a12 - 1, 1, 0, 0, 0, 0);
  const end = new Date(ano, mes1a12, 1, 0, 0, 0, 0);
  return { start, end };
}

// Lógica de negócio para emissão da Carteirinha Física CEF.
// Todas as datas são tratadas no fuso America/Sao_Paulo.

const TZ = "America/Sao_Paulo";

function nowInBrasilia(): Date {
  // Retorna um Date cujos campos locais correspondem ao horário de Brasília.
  const now = new Date();
  const brt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const p = Object.fromEntries(brt.map((x) => [x.type, x.value]));
  return new Date(
    `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`,
  );
}

export function currentMonth(): number {
  return nowInBrasilia().getMonth() + 1; // 1-12
}

export function currentYear(): number {
  return nowInBrasilia().getFullYear();
}

// Trimestre a partir de um mês (1-12) → 1|2|3|4
export function monthToQuarter(month: number): 1 | 2 | 3 | 4 {
  return (Math.ceil(month / 3) as 1 | 2 | 3 | 4);
}

export function currentQuarter(): { quarter: 1 | 2 | 3 | 4; year: number } {
  const m = currentMonth();
  const y = currentYear();
  return { quarter: monthToQuarter(m), year: y };
}

export function quarterLabel(quarter: number, year: number): string {
  return `${quarter}º tri/${year}`;
}

// Janelas trimestrais -------------------------------------------------------

// Solicitações: janeiro (1), abril (4), julho (7), outubro (10)
const REQUEST_MONTHS = [1, 4, 7, 10];
// Emissão: abril (4), julho (7), outubro (10)
const ISSUANCE_MONTHS = [4, 7, 10];

export function isRequestWindowOpen(month = currentMonth()): boolean {
  return REQUEST_MONTHS.includes(month);
}

export function isIssuanceWindowOpen(month = currentMonth()): boolean {
  return ISSUANCE_MONTHS.includes(month);
}

export function nextRequestWindowDate(month = currentMonth(), year = currentYear()): Date {
  for (const m of REQUEST_MONTHS) {
    if (m > month) return new Date(year, m - 1, 1);
  }
  // Próximo ano — primeiro mês da janela
  return new Date(year + 1, REQUEST_MONTHS[0]! - 1, 1);
}

export function nextIssuanceWindowDate(month = currentMonth(), year = currentYear()): Date {
  for (const m of ISSUANCE_MONTHS) {
    if (m > month) return new Date(year, m - 1, 1);
  }
  return new Date(year + 1, ISSUANCE_MONTHS[0]! - 1, 1);
}

// Rótulo legível da próxima janela
export function nextWindowLabel(windowFn: () => Date): string {
  const d = windowFn();
  const diff = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (diff <= 0) return "Janela ATIVA";
  if (diff === 1) return "Abre amanhã";
  return `Abre em ${diff} dias`;
}

// Elegibilidade -------------------------------------------------------------

export type EligibilitySnapshot = {
  isEligible: boolean;
  criterion1: {
    met: boolean;
    memberSince: string; // ISO
    monthsAsOf: number;
  };
  criterion2: {
    met: boolean;
    meetings: number;   // reuniões sociais realizadas
    activities: number; // atividades realizadas
    meetingDetails: { name: string; date: string }[];
    activityDetails: { name: string; date: string }[];
  };
};

type EventReg = {
  event: {
    name: string;
    dateTime: Date;
    status: string;
    eventCategory: string;
  };
};

export function checkEligibility(
  memberCreatedAt: Date,
  eventRegistrations: EventReg[],
): EligibilitySnapshot {
  const now = nowInBrasilia();

  // Critério 1 — sócio há mais de 3 meses
  const diffMs = now.getTime() - memberCreatedAt.getTime();
  const monthsAsOf = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  const criterion1Met = monthsAsOf >= 3;

  // Critério 2 — 2 reuniões + 2 atividades realizadas
  const realized = eventRegistrations.filter((r) => r.event.status === "REALIZADO");
  const meetings = realized.filter((r) => r.event.eventCategory === "REUNIAO");
  const activities = realized.filter((r) => r.event.eventCategory === "ATIVIDADE");

  const criterion2Met = meetings.length >= 2 && activities.length >= 2;

  return {
    isEligible: criterion1Met || criterion2Met,
    criterion1: {
      met: criterion1Met,
      memberSince: memberCreatedAt.toISOString(),
      monthsAsOf,
    },
    criterion2: {
      met: criterion2Met,
      meetings: meetings.length,
      activities: activities.length,
      meetingDetails: meetings.map((r) => ({
        name: r.event.name,
        date: r.event.dateTime.toISOString(),
      })),
      activityDetails: activities.map((r) => ({
        name: r.event.name,
        date: r.event.dateTime.toISOString(),
      })),
    },
  };
}

// Etapas --------------------------------------------------------------------

export type PhysicalCardStage =
  | "payment_pending"
  | "minimum_requirements"
  | "issuance_pending"
  | "in_production"
  | "awaiting_pickup"
  | "delivered"
  | "rejected";

export const STAGE_LABELS: Record<PhysicalCardStage, string> = {
  payment_pending: "Pagamento Pendente",
  minimum_requirements: "Exigências Mínimas",
  issuance_pending: "Aguardando Emissão",
  in_production: "Em Produção",
  awaiting_pickup: "Aguardando Retirada",
  delivered: "Entregue",
  rejected: "Reprovada",
};

// Ordem das etapas por tipo de solicitação
const STAGE_ORDER_PRIMEIRA_VIA: PhysicalCardStage[] = [
  "minimum_requirements",
  "issuance_pending",
  "in_production",
  "awaiting_pickup",
  "delivered",
];

const STAGE_ORDER_SEGUNDA_VIA: PhysicalCardStage[] = [
  "payment_pending",
  "issuance_pending",
  "in_production",
  "awaiting_pickup",
  "delivered",
];

export function getStageOrder(requestType = "PRIMEIRA_VIA"): PhysicalCardStage[] {
  return requestType === "SEGUNDA_VIA" ? STAGE_ORDER_SEGUNDA_VIA : STAGE_ORDER_PRIMEIRA_VIA;
}

// Mantido para compatibilidade (primeira via)
export const STAGE_ORDER = STAGE_ORDER_PRIMEIRA_VIA;

export function stageIndex(stage: PhysicalCardStage, requestType = "PRIMEIRA_VIA"): number {
  const order = getStageOrder(requestType);
  const idx = order.indexOf(stage);
  return idx === -1 ? -1 : idx;
}

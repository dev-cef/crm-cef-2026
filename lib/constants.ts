export const SEX_OPTIONS = [
  { value: "M", label: "Masculino" },
  { value: "F", label: "Feminino" },
] as const;

export const BLOOD_TYPES = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "NAO_SEI",
] as const;

export const BLOOD_TYPE_LABELS: Record<string, string> = {
  "A+": "A+",
  "A-": "A-",
  "B+": "B+",
  "B-": "B-",
  "AB+": "AB+",
  "AB-": "AB-",
  "O+": "O+",
  "O-": "O-",
  NAO_SEI: "Não sei",
};

export const HEALTH_CONDITIONS = [
  "Alérgico",
  "Hipertensão",
  "Diabetes",
  "Vertigens",
  "Problema cardíaco",
  "Problema pulmonar",
  "Doença reumática",
  "Doença hematológica",
  "Hérnia",
  "Outros",
] as const;

export const MOUNTAIN_EXPERIENCE = [
  { value: "NUNCA", label: "Nunca pratiquei" },
  { value: "MENOS_1", label: "Menos de 1 ano" },
  { value: "MAIS_1", label: "Mais de 1 ano" },
  { value: "MAIS_5", label: "Mais de 5 anos" },
  { value: "MAIS_10", label: "Mais de 10 anos" },
  { value: "PARADO", label: "Já pratiquei, mas estou parado há alguns anos" },
] as const;

export const MEMBER_STATUS = [
  { value: "ACTIVE", label: "Ativo" },
  { value: "INACTIVE", label: "Inativo" },
] as const;

export const PAYMENT_STATUS = [
  { value: "PAGO", label: "Pago" },
  { value: "PENDENTE", label: "Pendente" },
  { value: "ATRASADO", label: "Atrasado" },
] as const;

export const EVENT_DIFFICULTY = [
  { value: "FACIL", label: "Fácil" },
  { value: "MODERADO", label: "Moderado" },
  { value: "DIFICIL", label: "Difícil" },
  { value: "TECNICO", label: "Técnico" },
] as const;

export const EVENT_STATUS = [
  { value: "PLANEJADO", label: "Planejado" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "REALIZADO", label: "Realizado" },
  { value: "CANCELADO", label: "Cancelado" },
] as const;

// Categorias detalhadas de evento.
// isArpCounterpart=true → conta para a meta de 6 contrapartidas ARP do ano (R1).
// requiresGuide=true → exige Member com isGuide ao cadastrar (R3).
export const EVENT_CATEGORIES = [
  {
    value: "altos_papos",
    label: "Altos Papos",
    department: "social",
    isArpCounterpart: true,
    requiresGuide: false,
  },
  {
    value: "cef_cine_montanha",
    label: "CEF Cine Montanha",
    department: "social",
    isArpCounterpart: true,
    requiresGuide: false,
  },
  {
    value: "aniversario_cef",
    label: "Aniversário CEF",
    department: "social",
    isArpCounterpart: false,
    requiresGuide: false,
  },
  {
    value: "confraternizacao",
    label: "Confraternização",
    department: "social",
    isArpCounterpart: false,
    requiresGuide: false,
  },
  {
    value: "escalada",
    label: "Escalada",
    department: "outdoor",
    isArpCounterpart: false,
    requiresGuide: true,
  },
  {
    value: "caminhada",
    label: "Caminhada",
    department: "outdoor",
    isArpCounterpart: false,
    requiresGuide: true,
  },
  {
    value: "bike",
    label: "Bike",
    department: "outdoor",
    isArpCounterpart: false,
    requiresGuide: true,
  },
  {
    value: "acampamento",
    label: "Acampamento",
    department: "outdoor",
    isArpCounterpart: false,
    requiresGuide: true,
  },
  {
    value: "muro_escalada",
    label: "Muro de Escalada",
    department: "outdoor",
    isArpCounterpart: false,
    requiresGuide: false,
  },
  {
    value: "reuniao_social",
    label: "Reunião Social",
    department: "social",
    isArpCounterpart: false,
    requiresGuide: false,
  },
] as const;

export type EventCategoryValue = (typeof EVENT_CATEGORIES)[number]["value"];

export const ARP_COUNTERPART_CODES = [
  "altos_papos",
  "cef_cine_montanha",
] as const satisfies readonly EventCategoryValue[];

export const ARP_META_DEFAULT = 6;

// Super-categorias: "Eventos" (sociais) e "Atividades" (outdoor)
export const EVENTO_CATEGORY_CODES = [
  "altos_papos",
  "cef_cine_montanha",
  "aniversario_cef",
  "confraternizacao",
  "reuniao_social",
] as const satisfies readonly EventCategoryValue[];

export const ATIVIDADE_CATEGORY_CODES = [
  "muro_escalada",
  "caminhada",
  "escalada",
  "acampamento",
  "bike",
] as const satisfies readonly EventCategoryValue[];

export type SuperCategory = "evento" | "atividade";

export function getSuperCategory(code: string | null | undefined): SuperCategory | null {
  if (!code) return null;
  if ((EVENTO_CATEGORY_CODES as readonly string[]).includes(code)) return "evento";
  if ((ATIVIDADE_CATEGORY_CODES as readonly string[]).includes(code)) return "atividade";
  return null;
}

export function getEventCategory(code: string | null | undefined) {
  if (!code) return undefined;
  return EVENT_CATEGORIES.find((c) => c.value === code);
}

export const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const INTEREST_FIELDS = [
  { key: "interestHiking", label: "Caminhada" },
  { key: "interestClimbing", label: "Escalada" },
  { key: "interestCourse", label: "Curso de Montanhismo / Escalada" },
  { key: "interestBike", label: "Bike" },
  { key: "interestEcological", label: "Campanhas Ecológicas" },
  { key: "interestEvent", label: "Ajuda em evento?" },
] as const;

export function labelFrom(
  options: ReadonlyArray<{ value: string; label: string }>,
  value: string,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

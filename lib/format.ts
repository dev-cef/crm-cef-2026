// Aceita number ou Prisma.Decimal (campos monetários). Decimal coage via Number().
type Numeric = number | { toString(): string };

// Normaliza um valor monetário (number | Decimal | null) para number.
export function toNum(value: Numeric | null | undefined): number {
  return value == null ? 0 : Number(value);
}

export function formatBRL(value: Numeric | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(toNum(value));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function calculateAge(birthDate: Date | string): number {
  const d = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  const today = new Date();
  let age = today.getFullYear() - d.getUTCFullYear();
  const m = today.getMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getUTCDate())) age--;
  return age;
}

export function ageRange(age: number): string {
  if (age < 18) return "Menor de idade";
  if (age <= 29) return "18-29 anos";
  if (age <= 39) return "30-39 anos";
  if (age <= 49) return "40-49 anos";
  if (age <= 59) return "50-59 anos";
  return "60+ anos";
}

// "DD/MM/AAAA" -> Date (UTC) | null
export function parseBrDate(value: string): Date | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const date = new Date(Date.UTC(+yyyy, +mm - 1, +dd));
  if (
    date.getUTCFullYear() !== +yyyy ||
    date.getUTCMonth() !== +mm - 1 ||
    date.getUTCDate() !== +dd
  ) {
    return null;
  }
  return date;
}

// Date -> "DD/MM/AAAA"
export function toBrDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Máscaras de input (aplicadas no onChange)
export function maskCpfInput(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskPhoneInput(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  }
  return d
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .replace(/(-\d{4})\d+?$/, "$1");
}

export function maskCepInput(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export function maskDateInput(v: string): string {
  return v
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{2})(\d)/, "$1/$2")
    .replace(/(\d{2})(\d)/, "$1/$2");
}

// Date -> "YYYY-MM-DDTHH:mm" (para input datetime-local, horário local)
export function toDatetimeLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate(),
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "DARIO DO nascimento" / "dario do nascimento" -> "Dario do Nascimento"
export function formatPersonName(input: string): string {
  const connectors = new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "di",
    "du",
  ]);
  return input
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((word, i) => {
      if (i > 0 && connectors.has(word)) return word;
      return word
        .split("-")
        .map((part) =>
          part
            ? part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1)
            : part,
        )
        .join("-");
    })
    .join(" ");
}

export function monthName(month: number): string {
  return [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ][month - 1] ?? "";
}

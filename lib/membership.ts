// Carteirinha de sócio: validade anual (até 31/12 do ano corrente)
export function membershipValidity(ref: Date = new Date()): Date {
  return new Date(Date.UTC(ref.getUTCFullYear(), 11, 31));
}

export function membershipNumber(registration: number): string {
  return `CEF-${String(registration).padStart(5, "0")}`;
}

export function validationUrl(memberId: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/validar/${memberId}`;
}

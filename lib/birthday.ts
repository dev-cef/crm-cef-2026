export type BirthdayPeriod = "dia" | "semana" | "mes" | "ano";

// Compara mês/dia ignorando o ano
function md(d: Date): number {
  return (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

export function isBirthdayInPeriod(
  birthDate: Date,
  period: BirthdayPeriod,
  month: number,
  today: Date = new Date(),
): boolean {
  const bM = birthDate.getUTCMonth() + 1;

  if (period === "ano") return true;

  if (period === "mes") {
    return bM === month;
  }

  if (period === "dia") {
    return (
      bM === today.getMonth() + 1 &&
      birthDate.getUTCDate() === today.getDate()
    );
  }

  // semana: aniversário nos próximos 7 dias (incluindo hoje)
  const start = md(
    new Date(Date.UTC(2000, today.getMonth(), today.getDate())),
  );
  const cur = bM * 100 + birthDate.getUTCDate();
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(2000, today.getMonth(), today.getDate() + i));
    if ((d.getUTCMonth() + 1) * 100 + d.getUTCDate() === cur) return true;
  }
  void start;
  return false;
}

export function buildBirthdayMessage(template: string, name: string): string {
  const firstName = name.split(" ")[0] ?? name;
  return template.replaceAll("{nome}", firstName).replaceAll("{nomeCompleto}", name);
}

export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

export function buildEmailHtml(message: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <div style="background:#18181b;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
        <strong style="font-size:16px">Clube Excursionista de Friburgo</strong>
      </div>
      <div style="border:1px solid #e4e4e7;border-top:0;padding:24px;border-radius:0 0 8px 8px">
        <p style="font-size:16px;color:#09090b;margin:0 0 16px">${message}</p>
        <p style="font-size:13px;color:#71717a;margin:0">
          — Equipe CEF 🏔️
        </p>
      </div>
    </div>
  `.trim();
}

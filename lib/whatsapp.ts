const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

export async function sendWhatsAppMessage(phone: string, message: string): Promise<void> {
  if (!BASE_URL || !API_KEY || !INSTANCE) {
    throw new Error("Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE).");
  }

  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;

  const res = await fetch(`${BASE_URL}/message/sendText/${INSTANCE}`, {
    method: "POST",
    headers: {
      "apikey": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number, text: message }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution API ${res.status}: ${body}`);
  }
}

export async function sendWhatsAppGroupMessage(groupJid: string, message: string): Promise<void> {
  if (!BASE_URL || !API_KEY || !INSTANCE) {
    throw new Error("Evolution API não configurada.");
  }

  const res = await fetch(`${BASE_URL}/message/sendText/${INSTANCE}`, {
    method: "POST",
    headers: {
      "apikey": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number: groupJid, text: message }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution API ${res.status}: ${body}`);
  }
}

export function evolutionConfigured(): boolean {
  return !!(BASE_URL && API_KEY && INSTANCE);
}

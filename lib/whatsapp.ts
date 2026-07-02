const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

// Envia via Evolution e retorna o ID da mensagem (key.id), quando disponível —
// usado pra casar respostas (reply) no grupo com o pagamento correspondente.
async function sendText(number: string, message: string): Promise<string | null> {
  if (!BASE_URL || !API_KEY || !INSTANCE) {
    throw new Error("Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE).");
  }

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

  const data = await res.json().catch(() => null);
  return data?.key?.id ?? null;
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<string | null> {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return sendText(number, message);
}

export async function sendWhatsAppGroupMessage(groupJid: string, message: string): Promise<string | null> {
  return sendText(groupJid, message);
}

export function evolutionConfigured(): boolean {
  return !!(BASE_URL && API_KEY && INSTANCE);
}

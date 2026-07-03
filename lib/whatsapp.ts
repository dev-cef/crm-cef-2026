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

// Envia mídia (imagem/PDF a partir de um data URI base64) com legenda. Retorna key.id.
async function sendMedia(number: string, dataUri: string, caption: string): Promise<string | null> {
  if (!BASE_URL || !API_KEY || !INSTANCE) {
    throw new Error("Evolution API não configurada.");
  }
  const comma = dataUri.indexOf(",");
  const meta = comma >= 0 ? dataUri.slice(0, comma) : "";
  const base64 = comma >= 0 ? dataUri.slice(comma + 1) : dataUri;
  const mimetype = meta.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const isImage = mimetype.startsWith("image/");
  const mediatype = isImage ? "image" : "document";
  const ext = isImage ? mimetype.split("/")[1] || "jpg" : "pdf";

  const res = await fetch(`${BASE_URL}/message/sendMedia/${INSTANCE}`, {
    method: "POST",
    headers: { apikey: API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ number, mediatype, mimetype, media: base64, caption, fileName: `comprovante.${ext}` }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Evolution API ${res.status}: ${body}`);
  }
  const data = await res.json().catch(() => null);
  return data?.key?.id ?? null;
}

export async function sendWhatsAppMedia(phone: string, dataUri: string, caption: string): Promise<string | null> {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return sendMedia(number, dataUri, caption);
}

export async function sendWhatsAppGroupMedia(groupJid: string, dataUri: string, caption: string): Promise<string | null> {
  return sendMedia(groupJid, dataUri, caption);
}

export function evolutionConfigured(): boolean {
  return !!(BASE_URL && API_KEY && INSTANCE);
}

// Lista participantes de um grupo como pares { lid, phone } (só dígitos).
export async function fetchGroupParticipants(
  groupJid: string,
): Promise<{ lid: string; phone: string }[]> {
  if (!BASE_URL || !API_KEY || !INSTANCE || !groupJid) return [];
  try {
    const res = await fetch(
      `${BASE_URL}/group/participants/${INSTANCE}?groupJid=${encodeURIComponent(groupJid)}`,
      { headers: { apikey: API_KEY } },
    );
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    const arr: unknown[] = data?.participants ?? data ?? [];
    return arr
      .map((p) => {
        const rec = p as Record<string, unknown>;
        return {
          lid: String(rec.id ?? "").split("@")[0],
          phone: String(rec.jid ?? "").replace(/\D/g, ""),
        };
      })
      .filter((x) => x.lid && x.phone);
  } catch {
    return [];
  }
}

// Cache lid→telefone por grupo (TTL curto) pra não buscar participantes a cada webhook.
const participantCache = new Map<string, { at: number; map: Map<string, string> }>();

// Resolve o telefone (só dígitos) de um participante de grupo. Grupos com
// addressingMode "lid" entregam o remetente como "<lid>@lid"; a lista de
// participantes mapeia esse lid para o jid real (telefone).
export async function resolveGroupParticipantPhone(
  groupJid: string,
  participantId: string,
): Promise<string | null> {
  if (!BASE_URL || !API_KEY || !INSTANCE || !participantId) return null;
  const local = participantId.split("@")[0];
  if (participantId.includes("@s.whatsapp.net")) return local.replace(/\D/g, "");

  const cached = participantCache.get(groupJid);
  let map = cached && Date.now() - cached.at < 5 * 60_000 ? cached.map : null;
  if (!map) {
    try {
      const res = await fetch(
        `${BASE_URL}/group/participants/${INSTANCE}?groupJid=${encodeURIComponent(groupJid)}`,
        { headers: { apikey: API_KEY } },
      );
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      const arr: unknown[] = data?.participants ?? data ?? [];
      map = new Map<string, string>();
      for (const p of arr) {
        const rec = p as Record<string, unknown>;
        const pid = String(rec.id ?? "").split("@")[0];
        const phone = String(rec.jid ?? "").replace(/\D/g, "");
        if (pid && phone) map.set(pid, phone);
      }
      participantCache.set(groupJid, { at: Date.now(), map });
    } catch {
      return null;
    }
  }
  return map.get(local) ?? null;
}

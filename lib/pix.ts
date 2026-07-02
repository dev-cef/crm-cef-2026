// Gera o payload EMV ("Copia e Cola") do PIX estático/dinâmico, conforme o
// manual de padrões para iniciação do PIX do Banco Central (BR Code).

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}

// Remove acentos e caracteres fora do padrão aceito pelos campos do BR Code.
function sanitize(text: string, maxLength: number, fallback: string): string {
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .toUpperCase();
  return (normalized || fallback).slice(0, maxLength);
}

export function buildPixPayload({
  key,
  merchantName,
  merchantCity,
  amount,
  txid,
  description,
}: {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid?: string;
  description?: string;
}): string {
  const merchantAccountInfo = tlv(
    "26",
    tlv("00", "br.gov.bcb.pix") +
      tlv("01", key.trim()) +
      (description ? tlv("02", sanitize(description, 40, "")) : ""),
  );

  const txIdValue =
    (txid ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***";

  const withoutCrc =
    tlv("00", "01") + // Payload Format Indicator
    merchantAccountInfo +
    tlv("52", "0000") + // Merchant Category Code
    tlv("53", "986") + // Currency (BRL)
    (amount ? tlv("54", amount.toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", sanitize(merchantName, 25, "CEF")) +
    tlv("60", sanitize(merchantCity, 15, "NOVA FRIBURGO")) +
    tlv("62", tlv("05", txIdValue)) +
    "6304"; // CRC placeholder (id + length), valor calculado abaixo

  return withoutCrc + crc16(withoutCrc);
}

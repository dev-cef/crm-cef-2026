// Extração estruturada de dados de comprovante PIX (imagem) via Claude (visão).
// Retorna null quando a IA não está configurada ou falha — o pipeline trata
// isso encaminhando o comprovante para revisão manual, nunca bloqueia o fluxo.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const ExtracaoSchema = z.object({
  ehComprovante: z
    .boolean()
    .describe("true se a imagem é de fato um comprovante de pagamento/transferência"),
  valor: z
    .number()
    .nullable()
    .describe("Valor pago em reais (ex: 50.00). null se ilegível."),
  dataHora: z
    .string()
    .nullable()
    .describe("Data/hora da transação como aparece no comprovante. null se ilegível."),
  idTransacao: z
    .string()
    .nullable()
    .describe("ID/código da transação PIX (E2E ID ou similar). null se ausente."),
  nomePagador: z.string().nullable().describe("Nome do pagador. null se ausente."),
  instituicao: z
    .string()
    .nullable()
    .describe("Banco/instituição que emitiu o comprovante. null se ausente."),
  confianca: z
    .number()
    .describe("Confiança de 0 a 1 na extração, considerando a legibilidade da imagem."),
});

export type ComprovanteExtraido = z.infer<typeof ExtracaoSchema>;

export function anthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function extrairComprovante(
  imageDataUri: string,
): Promise<{ extracao: ComprovanteExtraido; raw: string } | null> {
  if (!anthropicConfigured()) return null;

  const comma = imageDataUri.indexOf(",");
  const meta = comma >= 0 ? imageDataUri.slice(0, comma) : "";
  const data = comma >= 0 ? imageDataUri.slice(comma + 1) : imageDataUri;
  const mediaType = meta.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  if (!mediaType.startsWith("image/")) return null; // PDFs etc. vão pra revisão manual

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data,
              },
            },
            {
              type: "text",
              text:
                "Esta imagem foi enviada como comprovante de pagamento de mensalidade de um clube. " +
                "Extraia os dados da transação. Se a imagem não for um comprovante de pagamento, " +
                "marque ehComprovante=false. Estime a confiança com base na legibilidade.",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(ExtracaoSchema) },
    });

    if (!response.parsed_output) return null;
    return { extracao: response.parsed_output, raw: JSON.stringify(response.parsed_output) };
  } catch (err) {
    console.error("[comprovante-ai] falha na extração:", err);
    return null;
  }
}

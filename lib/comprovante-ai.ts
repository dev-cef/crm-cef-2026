// Extração estruturada de dados de comprovante PIX (imagem/PDF) via IA (visão).
// Suporta múltiplos provedores — Claude (Anthropic), ChatGPT (OpenAI) e Gemini
// (Google) — escolhidos no painel (MessengerConfig.aiProvider/aiModel). A chave
// de API de cada provedor vem de variável de ambiente; sem chave, o provedor
// fica indisponível e o comprovante cai na revisão manual.
//
// Retorna null quando a IA não está configurada ou falha — o pipeline trata isso
// encaminhando o comprovante para revisão manual, nunca bloqueia o fluxo.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
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

// ─── Registro de provedores/modelos (fonte da verdade do seletor no painel) ───
// Adicionar um modelo novo é só incluir uma linha aqui — nenhuma outra mudança
// de código é necessária. Só entram provedores com boa leitura de imagem +
// saída estruturada (por isso DeepSeek/Qwen ficaram de fora: visão fraca pra
// comprovante, risco de baixa automática errada).

export type AiProviderId = "anthropic" | "openai" | "google";

export type AiModelOption = { id: string; label: string; note?: string };
export type AiProviderDef = {
  id: AiProviderId;
  label: string;
  envKey: string;
  models: AiModelOption[];
};

export const AI_PROVIDERS: AiProviderDef[] = [
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    envKey: "ANTHROPIC_API_KEY",
    models: [
      { id: "claude-opus-4-8", label: "Opus 4.8", note: "Mais preciso" },
      { id: "claude-sonnet-5", label: "Sonnet 5", note: "Equilíbrio" },
      { id: "claude-haiku-4-5", label: "Haiku 4.5", note: "Mais barato e rápido" },
    ],
  },
  {
    id: "openai",
    label: "ChatGPT (OpenAI)",
    envKey: "OPENAI_API_KEY",
    models: [
      { id: "gpt-4.1", label: "GPT-4.1", note: "Mais preciso" },
      { id: "gpt-4o", label: "GPT-4o", note: "Equilíbrio" },
      { id: "gpt-4o-mini", label: "GPT-4o mini", note: "Mais barato e rápido" },
    ],
  },
  {
    id: "google",
    label: "Gemini (Google)",
    envKey: "GEMINI_API_KEY",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", note: "Mais preciso" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "Equilíbrio" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", note: "Mais barato e rápido" },
    ],
  },
];

export const DEFAULT_PROVIDER: AiProviderId = "anthropic";
export const DEFAULT_MODEL = "claude-opus-4-8";

export function findProvider(id: string): AiProviderDef | undefined {
  return AI_PROVIDERS.find((p) => p.id === id);
}

// Um provedor só é utilizável se a chave de API dele estiver no ambiente.
export function providerConfigured(providerId: string): boolean {
  const p = findProvider(providerId);
  return !!p && !!process.env[p.envKey];
}

// IDs dos provedores que têm chave configurada — usado pela UI pra sinalizar
// quais opções estão prontas pra uso.
export function configuredProviders(): AiProviderId[] {
  return AI_PROVIDERS.filter((p) => process.env[p.envKey]).map((p) => p.id);
}

// Valida um par provedor/modelo contra o registro (usado na Server Action).
export function isValidProviderModel(providerId: string, modelId: string): boolean {
  const p = findProvider(providerId);
  return !!p && p.models.some((m) => m.id === modelId);
}

// ─── Extração ────────────────────────────────────────────────────────────────

type Media = { mediaType: string; data: string; dataUri: string; isPdf: boolean };

function parseDataUri(uri: string): Media | null {
  const comma = uri.indexOf(",");
  const meta = comma >= 0 ? uri.slice(0, comma) : "";
  const data = comma >= 0 ? uri.slice(comma + 1) : uri;
  const mediaType = meta.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  const isPdf = mediaType === "application/pdf";
  if (!isPdf && !mediaType.startsWith("image/")) return null; // outros formatos → revisão manual
  return { mediaType, data, dataUri: uri, isPdf };
}

const PROMPT =
  "Este arquivo foi enviado como comprovante de pagamento de mensalidade de um clube. " +
  "Extraia os dados da transação. Se não for um comprovante de pagamento, marque " +
  "ehComprovante=false. Estime a confiança (0 a 1) com base na legibilidade.";

// Instrução de formato para os provedores sem helper nativo de schema (OpenAI/Gemini):
// pedimos JSON puro e validamos com Zod do nosso lado (fonte única de verdade do schema).
const JSON_INSTRUCTION =
  "Responda SOMENTE com um objeto JSON válido, sem texto ou markdown ao redor, " +
  "com exatamente estas chaves:\n" +
  '- "ehComprovante" (boolean): true se é de fato um comprovante de pagamento/transferência\n' +
  '- "valor" (número ou null): valor pago em reais, ex: 50.00; null se ilegível\n' +
  '- "dataHora" (string ou null): data/hora da transação como aparece; null se ilegível\n' +
  '- "idTransacao" (string ou null): ID/código da transação PIX (E2E) ou similar; null se ausente\n' +
  '- "nomePagador" (string ou null): nome do pagador; null se ausente\n' +
  '- "instituicao" (string ou null): banco/instituição emissora; null se ausente\n' +
  '- "confianca" (número de 0 a 1): confiança na extração, considerando a legibilidade';

function safeParseJson(text: string | null | undefined): ComprovanteExtraido | null {
  if (!text) return null;
  // Alguns modelos embrulham em ```json … ``` mesmo pedindo JSON puro.
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = ExtracaoSchema.safeParse(JSON.parse(cleaned));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// Claude — helper nativo de saída estruturada (zodOutputFormat), PDF via bloco
// "document". Sem thinking explícito: mantém compatibilidade entre Opus/Sonnet/
// Haiku (adaptive não é aceito por todos) e a extração não exige raciocínio longo.
async function extractWithAnthropic(media: Media, model: string): Promise<ComprovanteExtraido | null> {
  const mediaBlock = media.isPdf
    ? ({
        type: "document" as const,
        source: { type: "base64" as const, media_type: "application/pdf" as const, data: media.data },
      } as const)
    : ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: media.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: media.data,
        },
      } as const);

  const client = new Anthropic();
  const response = await client.messages.parse({
    model,
    max_tokens: 2048,
    messages: [{ role: "user", content: [mediaBlock, { type: "text", text: PROMPT }] }],
    output_config: { format: zodOutputFormat(ExtracaoSchema) },
  });
  return response.parsed_output ?? null;
}

// OpenAI — JSON mode + validação Zod. Imagem via image_url (data URI); PDF via
// content part "file". Se o modelo/rota não aceitar PDF, o erro cai no catch de
// extrairComprovante e vira revisão manual.
async function extractWithOpenAI(media: Media, model: string): Promise<ComprovanteExtraido | null> {
  const client = new OpenAI();
  const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: `${PROMPT}\n\n${JSON_INSTRUCTION}` },
  ];
  if (media.isPdf) {
    parts.push({
      type: "file",
      file: { filename: "comprovante.pdf", file_data: media.dataUri },
    });
  } else {
    parts.push({ type: "image_url", image_url: { url: media.dataUri } });
  }
  const completion = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: parts }],
    response_format: { type: "json_object" },
  });
  return safeParseJson(completion.choices[0]?.message?.content);
}

// Gemini — inlineData (imagem ou PDF) + responseMimeType JSON + validação Zod.
async function extractWithGemini(media: Media, model: string): Promise<ComprovanteExtraido | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: `${PROMPT}\n\n${JSON_INSTRUCTION}` },
          { inlineData: { mimeType: media.mediaType, data: media.data } },
        ],
      },
    ],
    config: { responseMimeType: "application/json" },
  });
  return safeParseJson(response.text);
}

export async function extrairComprovante(
  imageDataUri: string,
  provider: string = DEFAULT_PROVIDER,
  model: string = DEFAULT_MODEL,
): Promise<{ extracao: ComprovanteExtraido; raw: string; provider: string; model: string } | null> {
  const prov = findProvider(provider) ? provider : DEFAULT_PROVIDER;
  const mdl = model || DEFAULT_MODEL;
  if (!providerConfigured(prov)) return null;

  const media = parseDataUri(imageDataUri);
  if (!media) return null;

  try {
    let extracao: ComprovanteExtraido | null = null;
    if (prov === "anthropic") extracao = await extractWithAnthropic(media, mdl);
    else if (prov === "openai") extracao = await extractWithOpenAI(media, mdl);
    else if (prov === "google") extracao = await extractWithGemini(media, mdl);

    if (!extracao) return null;
    return { extracao, raw: JSON.stringify(extracao), provider: prov, model: mdl };
  } catch (err) {
    console.error(`[comprovante-ai] falha na extração (${prov}/${mdl}):`, err);
    return null;
  }
}

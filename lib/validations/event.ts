import { z } from "zod";
import {
  ATIVIDADE_CATEGORY_CODES,
  EVENT_CATEGORIES,
  EVENT_STATUS,
  getEventCategory,
} from "@/lib/constants";

// Categorias que não exigem nome/descrição preenchidos pelo usuário (auto-gerados no server)
const AUTO_FILLED_CATEGORIES = ["reuniao_social", "aniversario_cef"] as const;

export const eventSchema = z
  .object({
    categoryCode: z.string().min(1, "Selecione o tipo de evento/atividade"),
    name: z.string().trim().default(""),
    description: z.string().trim().default(""),
    dateTime: z
      .string()
      .min(1, "Informe data e hora")
      .refine(
        (v) => !Number.isNaN(new Date(v).getTime()),
        "Data/hora inválida",
      ),
    location: z.string().trim().default(""),
    difficulty: z.string().default(""),
    slots: z.coerce.number().int().min(0, "Vagas inválidas").default(0),
    status: z.enum(
      EVENT_STATUS.map((o) => o.value) as [string, ...string[]],
      { message: "Selecione o status" },
    ),
    guideId: z.string().default(""),
    guideIds: z.array(z.string()).default([]),
    speakerName: z.string().trim().default(""),
    filmDuration: z.string().trim().default(""),
    attendeeIds: z.array(z.string()).default([]),
    generalAttendeeNames: z.array(z.string()).default([]),
    // Ficha Técnica (caminhada)
    fichaDistanciaKm:  z.coerce.number().positive().optional(),
    fichaTempo:        z.string().trim().default(""),
    fichaEsforco:      z.string().default(""),
    fichaInsolacao:    z.string().default(""),
    fichaDesnivelPos:  z.coerce.number().int().nonnegative().optional(),
    fichaElevacaoMax:  z.coerce.number().int().nonnegative().optional(),
    fichaExposicao:    z.string().default(""),
    fichaSaidaHorario: z.string().trim().default(""),
    fichaSaidaLocal:   z.string().trim().default(""),
    fichaCarona:       z.boolean().default(false),
    fichaOQueLevar:    z.array(z.string()).default([]),
    fichaObs:          z.string().trim().default(""),
    fichaAtencao:      z.string().trim().default(""),
  })
  .superRefine((data, ctx) => {
    const code = data.categoryCode;
    const cat = getEventCategory(code);
    const isAtividade = (ATIVIDADE_CATEGORY_CODES as readonly string[]).includes(code);
    const isAutoFilled = (AUTO_FILLED_CATEGORIES as readonly string[]).includes(code);

    // Nome obrigatório exceto para categorias auto-preenchidas
    if (!isAutoFilled && data.name.trim().length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Informe o nome (mín. 3 caracteres)",
      });
    }

    // Descrição obrigatória exceto para categorias auto-preenchidas
    if (!isAutoFilled && data.description.trim().length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["description"],
        message: "Descreva o evento (mín. 5 caracteres)",
      });
    }

    // Local obrigatório para atividades e confraternizacao
    const needsLocation = isAtividade || code === "confraternizacao";
    if (needsLocation && data.location.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["location"],
        message: "Informe o local",
      });
    }

    // R3 — categoria outdoor com requiresGuide exige pelo menos um guia
    if (cat?.requiresGuide && data.guideIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["guideIds"],
        message: `Categoria "${cat.label}" exige pelo menos um guia.`,
      });
    }

    // Palestrante obrigatório para Altos Papos
    if (code === "altos_papos" && data.speakerName.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["speakerName"],
        message: "Informe o nome do palestrante",
      });
    }

    // Duração obrigatória para CEF Cine Montanha
    if (code === "cef_cine_montanha" && data.filmDuration.trim().length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["filmDuration"],
        message: "Informe a duração do filme",
      });
    }

    // categoryCode deve ser um dos valores válidos
    if (!EVENT_CATEGORIES.find((c) => c.value === code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categoryCode"],
        message: "Categoria inválida",
      });
    }
  });

export type EventFormValues = z.input<typeof eventSchema>;

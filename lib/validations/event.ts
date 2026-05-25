import { z } from "zod";
import {
  EVENT_CATEGORIES,
  EVENT_DIFFICULTY,
  EVENT_STATUS,
  getEventCategory,
} from "@/lib/constants";

export const eventSchema = z
  .object({
    name: z.string().trim().min(3, "Informe o nome do evento"),
    description: z.string().trim().min(5, "Descreva o evento"),
    dateTime: z
      .string()
      .min(1, "Informe data e hora")
      .refine(
        (v) => !Number.isNaN(new Date(v).getTime()),
        "Data/hora inválida",
      ),
    location: z.string().trim().min(2, "Informe o local/trilha"),
    difficulty: z.enum(
      EVENT_DIFFICULTY.map((o) => o.value) as [string, ...string[]],
      { message: "Selecione a dificuldade" },
    ),
    slots: z.coerce.number().int().min(0, "Vagas inválidas"),
    status: z.enum(
      EVENT_STATUS.map((o) => o.value) as [string, ...string[]],
      { message: "Selecione o status" },
    ),
    categoryCode: z
      .enum(EVENT_CATEGORIES.map((c) => c.value) as [string, ...string[]], {
        message: "Selecione a categoria",
      })
      .optional()
      .or(z.literal("")),
    guideId: z.string().optional().or(z.literal("")),
  })
  // R3 — categoria outdoor exige guia associado.
  .superRefine((data, ctx) => {
    const cat = getEventCategory(data.categoryCode || undefined);
    if (cat?.requiresGuide && !data.guideId) {
      ctx.addIssue({
        code: "custom",
        path: ["guideId"],
        message: `Categoria "${cat.label}" exige um guia associado.`,
      });
    }
  });

export type EventFormValues = z.input<typeof eventSchema>;

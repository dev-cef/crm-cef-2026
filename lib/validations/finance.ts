import { z } from "zod";

export const planSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do plano"),
  monthlyPrice: z.coerce
    .number({ message: "Valor inválido" })
    .min(0, "Valor inválido"),
  billingPeriod: z.enum(["MENSAL", "ANUAL"]).default("MENSAL"),
  description: z.string().trim().optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export type PlanFormValues = z.input<typeof planSchema>;

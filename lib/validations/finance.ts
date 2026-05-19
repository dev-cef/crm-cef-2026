import { z } from "zod";

export const TRANSACTION_CATEGORIES = {
  ENTRADA: ["Mensalidade Manual", "Doação", "Patrocínio", "Taxa de Evento", "Outros"],
  SAIDA: ["Manutenção", "Material", "Equipamento", "Evento / Trilha", "Administrativo", "Sede", "Outros"],
} as const;

export const transactionSchema = z.object({
  type: z.enum(["ENTRADA", "SAIDA"]),
  category: z.string().trim().min(1, "Informe a categoria"),
  description: z.string().trim().min(2, "Informe a descrição"),
  amount: z.coerce.number({ message: "Valor inválido" }).positive("Valor deve ser positivo"),
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Data inválida (DD/MM/AAAA)"),
  notes: z.string().trim().optional().or(z.literal("")),
});

export type TransactionFormValues = z.input<typeof transactionSchema>;

export type TransactionFormState = {
  type: "ENTRADA" | "SAIDA";
  category: string;
  description: string;
  amount: number;
  date: string;
  notes: string;
};

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

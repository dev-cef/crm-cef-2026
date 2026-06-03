import { z } from "zod";

export const TRANSACTION_CATEGORIES = {
  ENTRADA: [
    "Mensalidade",
    "Inscrições",
    "Patrocínio",
    "Projetos ambientais",
    "Outros",
  ],
  SAIDA: [
    "Manutenção",
    "Material",
    "Equipamento",
    "Evento / Trilha",
    "Administrativo",
    "Sede",
    "Outros",
  ],
} as const;

export const TRANSACTION_SUBCATEGORIES: Record<string, string[]> = {
  // ENTRADA
  Mensalidade: ["Mensalidade Sócio Efetivo", "Mensalidade Sócio Familiar", "Mensalidade Estudante", "Taxa de Inscrição", "Regularização de débito"],
  Inscrições: ["Trilha / Caminhada", "Escalada", "Curso de montanhismo", "Bike", "Campanha ecológica", "Outro evento"],
  Patrocínio: ["Pessoa Física", "Empresa", "Apoio Institucional"],
  "Projetos ambientais": ["Edital público", "Convênio", "Doação vinculada"],
  Outros: ["Doação avulsa", "Multa / Ressarcimento", "Receita diversa"],
  // SAIDA
  Manutenção: [],
  Material: [],
  Equipamento: [],
  "Evento / Trilha": [],
  Administrativo: [],
  Sede: [],
};

export const PAYMENT_METHODS = [
  "PIX",
  "Transferência bancária",
  "Dinheiro",
  "Cartão de débito",
  "Cartão de crédito",
  "Boleto",
  "Cheque",
] as const;

export const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
] as const;

export const transactionSchema = z.object({
  type: z.enum(["ENTRADA", "SAIDA"]),
  category: z.string().trim().min(1, "Informe a categoria"),
  subcategory: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().min(2, "Informe a descrição"),
  amount: z.coerce.number({ message: "Valor inválido" }).positive("Valor deve ser positivo"),
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Data inválida (DD/MM/AAAA)"),
  competenceMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
  competenceYear: z.coerce.number().int().min(2000).max(2100).optional().nullable(),
  clubAccount: z.string().trim().optional().or(z.literal("")),
  payerName: z.string().trim().optional().or(z.literal("")),
  linkedActivity: z.string().trim().optional().or(z.literal("")),
  paymentMethod: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  supplierId: z.string().trim().optional().or(z.literal("")),
});

export type TransactionFormValues = z.input<typeof transactionSchema>;

export type TransactionFormState = {
  type: "ENTRADA" | "SAIDA";
  category: string;
  subcategory?: string;
  description: string;
  amount: number;
  date: string;
  competenceMonth?: number | null;
  competenceYear?: number | null;
  clubAccount?: string;
  payerName?: string;
  linkedActivity?: string;
  paymentMethod?: string;
  notes: string;
  supplierId?: string;
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

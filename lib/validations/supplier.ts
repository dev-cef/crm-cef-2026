import { z } from "zod";

export const SUPPLIER_TYPES = [
  { value: "TRANSPORTE",  label: "Transporte / Van" },
  { value: "EQUIPAMENTO", label: "Equipamentos" },
  { value: "ALIMENTACAO", label: "Alimentação" },
  { value: "SERVICO",     label: "Serviços Gerais" },
] as const;

export type SupplierTypeValue = (typeof SUPPLIER_TYPES)[number]["value"];

export const supplierSchema = z.object({
  name:     z.string().trim().min(2, "Informe o nome do fornecedor"),
  type:     z.enum(["TRANSPORTE", "EQUIPAMENTO", "ALIMENTACAO", "SERVICO"]),
  phone:    z.string().trim().optional().or(z.literal("")),
  email:    z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  document: z.string().trim().optional().or(z.literal("")),
  notes:    z.string().trim().optional().or(z.literal("")),
  active:   z.boolean().default(true),
});

export type SupplierFormValues = z.input<typeof supplierSchema>;

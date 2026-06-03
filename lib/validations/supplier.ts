import { z } from "zod";

export const supplierSchema = z.object({
  name:     z.string().trim().min(2, "Informe o nome do fornecedor"),
  type:     z.string().trim().min(1, "Selecione a categoria"),
  phone:    z.string().trim().optional().or(z.literal("")),
  email:    z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  document: z.string().trim().optional().or(z.literal("")),
  pix:      z.string().trim().optional().or(z.literal("")),
  notes:    z.string().trim().optional().or(z.literal("")),
  active:   z.boolean().default(true),
});

export type SupplierFormValues = z.input<typeof supplierSchema>;

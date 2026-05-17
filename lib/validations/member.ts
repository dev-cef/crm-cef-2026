import { z } from "zod";
import { isValidCpf } from "@/lib/cpf";
import { parseBrDate } from "@/lib/format";
import {
  BLOOD_TYPES,
  HEALTH_CONDITIONS,
  MOUNTAIN_EXPERIENCE,
  UF_OPTIONS,
} from "@/lib/constants";

const interest = z.coerce
  .number()
  .int()
  .min(1, "Selecione de 1 a 5")
  .max(5);

export const memberSchema = z
  .object({
    // Seção 01 — Informações Pessoais
    fullName: z.string().trim().min(3, "Informe o nome completo"),
    sex: z.enum(["M", "F"], { message: "Selecione o sexo" }),
    email: z.email("E-mail inválido"),
    phone: z
      .string()
      .trim()
      .refine((v) => v.replace(/\D/g, "").length >= 10, "Telefone inválido"),
    birthDate: z
      .string()
      .trim()
      .refine((v) => parseBrDate(v) !== null, "Data inválida (DD/MM/AAAA)")
      .refine((v) => {
        const d = parseBrDate(v);
        return d !== null && d.getTime() <= Date.now();
      }, "Data não pode ser no futuro"),
    cpf: z.string().refine((v) => isValidCpf(v), "CPF inválido"),
    instagram: z.string().trim().optional().or(z.literal("")),
    photoUrl: z.string().optional().or(z.literal("")),

    // Seção 02 — Endereço
    cep: z
      .string()
      .trim()
      .refine((v) => v.replace(/\D/g, "").length === 8, "CEP inválido"),
    street: z.string().trim().min(1, "Informe o logradouro"),
    number: z.string().trim().min(1, "Informe o número"),
    complement: z.string().trim().optional().or(z.literal("")),
    neighborhood: z.string().trim().min(1, "Informe o bairro"),
    city: z.string().trim().min(1, "Informe a cidade"),
    state: z.enum(UF_OPTIONS, { message: "Selecione o estado" }),

    // Seção 03 — Saúde e Emergência
    bloodType: z.enum(BLOOD_TYPES, { message: "Selecione o tipo sanguíneo" }),
    emergencyName: z.string().trim().min(3, "Informe o contato de emergência"),
    emergencyPhone: z
      .string()
      .trim()
      .refine((v) => v.replace(/\D/g, "").length >= 10, "Telefone inválido"),
    healthConditions: z.array(z.enum(HEALTH_CONDITIONS)).default([]),
    healthDetails: z.string().trim().optional().or(z.literal("")),

    // Seção 04 — Experiência em Atividades de Montanha
    mountainExperience: z.enum(
      MOUNTAIN_EXPERIENCE.map((o) => o.value) as [string, ...string[]],
      { message: "Selecione a experiência" },
    ),
    otherGroup: z.boolean().default(false),
    otherGroupName: z.string().trim().optional().or(z.literal("")),

    // Seção 05 — Interesses
    interestHiking: interest,
    interestClimbing: interest,
    interestCourse: interest,
    interestBike: interest,
    interestEcological: interest,
    suggestions: z.string().trim().optional().or(z.literal("")),

    // Vínculo
    planId: z.string().optional().or(z.literal("")),
    status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),

    // Administração (só edição)
    createdAt: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine(
        (v) => !v || parseBrDate(v) !== null,
        "Data inválida (DD/MM/AAAA)",
      ),
  })
  .refine(
    (d) => !d.otherGroup || (d.otherGroupName ?? "").trim().length > 0,
    { message: "Informe o nome do grupo", path: ["otherGroupName"] },
  )
  .refine(
    (d) =>
      d.healthConditions.length === 0 ||
      (d.healthDetails ?? "").trim().length > 0,
    {
      message: "Descreva a doença/alergia selecionada",
      path: ["healthDetails"],
    },
  );

export type MemberFormValues = z.input<typeof memberSchema>;
export type MemberParsed = z.output<typeof memberSchema>;

// Campos validados por etapa (para validação incremental no formulário)
export const STEP_FIELDS: Record<number, (keyof MemberFormValues)[]> = {
  0: ["fullName", "sex", "email", "phone", "birthDate", "cpf"],
  1: ["cep", "street", "number", "neighborhood", "city", "state"],
  2: [
    "bloodType",
    "emergencyName",
    "emergencyPhone",
    "healthConditions",
    "healthDetails",
  ],
  3: ["mountainExperience", "otherGroup", "otherGroupName"],
  4: [
    "interestHiking",
    "interestClimbing",
    "interestCourse",
    "interestBike",
    "interestEcological",
  ],
};

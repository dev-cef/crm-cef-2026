import { stripCpf } from "@/lib/cpf";
import { formatPersonName, parseBrDate } from "@/lib/format";
import { memberSchema, type MemberFormValues } from "@/lib/validations/member";

// Valida e normaliza os dados do formulário de associado para o formato
// do Prisma. Compartilhado entre o cadastro admin e o auto-cadastro.
export function normalizeMember(values: MemberFormValues) {
  const parsed = memberSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const error = first
      ? `${first.path.join(".")}: ${first.message}`
      : "Dados inválidos";
    return { ok: false as const, error };
  }
  const d = parsed.data;
  return {
    ok: true as const,
    data: {
      fullName: formatPersonName(d.fullName),
      sex: d.sex,
      email: d.email.toLowerCase(),
      phone: d.phone,
      instagram: d.instagram || null,
      birthDate: parseBrDate(d.birthDate)!,
      cpf: stripCpf(d.cpf),
      photoUrl: d.photoUrl || null,
      cep: d.cep,
      street: d.street,
      number: d.number,
      complement: d.complement || null,
      neighborhood: d.neighborhood,
      city: d.city,
      state: d.state,
      bloodType: d.bloodType,
      emergencyName: formatPersonName(d.emergencyName),
      emergencyPhone: d.emergencyPhone,
      healthConditions: JSON.stringify(d.healthConditions),
      healthDetails: d.healthDetails || null,
      mountainExperience: d.mountainExperience,
      otherGroup: d.otherGroup,
      otherGroupName: d.otherGroup ? d.otherGroupName || null : null,
      interestHiking: d.interestHiking,
      interestClimbing: d.interestClimbing,
      interestCourse: d.interestCourse,
      interestBike: d.interestBike,
      interestEcological: d.interestEcological,
      interestEvent: d.interestEvent,
      suggestions: d.suggestions || null,
      planId: d.planId || null,
      status: d.status,
      isGuide: d.isGuide,
      ...(d.createdAt ? { createdAt: parseBrDate(d.createdAt)! } : {}),
    },
  } as const;
}

export function memberDbError(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? e);
  if (msg.includes("Member_cpf_key") || msg.includes("cpf"))
    return "Já existe um associado com este CPF.";
  if (msg.includes("User_email_key"))
    return "Já existe uma conta com este e-mail.";
  if (msg.includes("Unique") || msg.includes("P2002"))
    return "Registro duplicado.";
  return "Erro ao salvar. Tente novamente.";
}

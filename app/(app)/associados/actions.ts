"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { stripCpf } from "@/lib/cpf";
import { formatPersonName, parseBrDate } from "@/lib/format";
import { memberSchema, type MemberFormValues } from "@/lib/validations/member";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function normalize(values: MemberFormValues) {
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
      emergencyName: d.emergencyName,
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
      suggestions: d.suggestions || null,
      planId: d.planId || null,
      status: d.status,
    },
  } as const;
}

function dbError(e: unknown): string {
  const msg = String((e as { message?: string })?.message ?? e);
  if (msg.includes("Member_cpf_key") || msg.includes("cpf"))
    return "Já existe um associado com este CPF.";
  if (msg.includes("Unique") || msg.includes("P2002"))
    return "Registro duplicado.";
  return "Erro ao salvar. Tente novamente.";
}

export async function createMember(
  values: MemberFormValues,
): Promise<ActionResult> {
  const session = await auth();
  const n = normalize(values);
  if (!n.ok) return { ok: false, error: n.error };

  try {
    const member = await prisma.$transaction(async (tx) => {
      const agg = await tx.member.aggregate({
        _max: { registration: true },
      });
      const nextReg = (agg._max.registration ?? 999) + 1;
      return tx.member.create({
        data: { ...n.data, registration: nextReg },
      });
    });

    await recordAudit({
      userId: session?.user?.id,
      action: "CREATE",
      entity: "Member",
      entityId: member.id,
      metadata: { fullName: member.fullName, registration: member.registration },
    });

    revalidatePath("/associados");
    revalidatePath("/dashboard");
    return { ok: true, id: member.id };
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
}

export async function updateMember(
  id: string,
  values: MemberFormValues,
): Promise<ActionResult> {
  const session = await auth();
  const n = normalize(values);
  if (!n.ok) return { ok: false, error: n.error };

  try {
    const member = await prisma.member.update({
      where: { id },
      data: n.data,
    });

    await recordAudit({
      userId: session?.user?.id,
      action: "UPDATE",
      entity: "Member",
      entityId: member.id,
      metadata: { fullName: member.fullName },
    });

    revalidatePath("/associados");
    revalidatePath(`/associados/${id}`);
    revalidatePath("/dashboard");
    return { ok: true, id: member.id };
  } catch (e) {
    return { ok: false, error: dbError(e) };
  }
}

export async function softDeleteMember(id: string): Promise<ActionResult> {
  const session = await auth();
  try {
    await prisma.member.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });

    await recordAudit({
      userId: session?.user?.id,
      action: "DELETE",
      entity: "Member",
      entityId: id,
    });

    revalidatePath("/associados");
    revalidatePath("/dashboard");
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Erro ao excluir o associado." };
  }
}

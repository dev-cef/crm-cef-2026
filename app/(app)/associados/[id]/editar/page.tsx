import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCpf } from "@/lib/cpf";
import { toBrDate } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { MemberForm } from "@/components/modules/associados/member-form";

export const dynamic = "force-dynamic";

export default async function EditarAssociadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [member, plans] = await Promise.all([
    prisma.member.findFirst({ where: { id, deletedAt: null } }),
    prisma.plan.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!member) notFound();

  let conditions: string[] = [];
  try {
    conditions = JSON.parse(member.healthConditions) as string[];
  } catch {
    conditions = [];
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Editar associado"
        description={member.fullName}
      />
      <MemberForm
        mode="edit"
        plans={plans}
        member={{
          id: member.id,
          fullName: member.fullName,
          sex: member.sex,
          email: member.email,
          phone: member.phone,
          instagram: member.instagram,
          whatsapp: member.whatsapp,
          birthDate: toBrDate(member.birthDate),
          cpf: formatCpf(member.cpf),
          photoUrl: member.photoUrl,
          cep: member.cep,
          street: member.street,
          number: member.number,
          complement: member.complement,
          neighborhood: member.neighborhood,
          city: member.city,
          state: member.state,
          bloodType: member.bloodType,
          emergencyName: member.emergencyName,
          emergencyPhone: member.emergencyPhone,
          healthConditions: conditions,
          healthDetails: member.healthDetails,
          mountainExperience: member.mountainExperience,
          otherGroup: member.otherGroup,
          otherGroupName: member.otherGroupName,
          interestHiking: member.interestHiking,
          interestClimbing: member.interestClimbing,
          interestCourse: member.interestCourse,
          interestBike: member.interestBike,
          interestEcological: member.interestEcological,
          suggestions: member.suggestions,
          planId: member.planId,
          status: member.status,
        }}
      />
    </div>
  );
}

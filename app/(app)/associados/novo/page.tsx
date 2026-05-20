import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { MemberForm } from "@/components/modules/associados/member-form";

export const dynamic = "force-dynamic";

export default async function NovoAssociadoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = toSessionUser(session.user);
  if (!(await can(user, "associados", "create"))) redirect("/associados");

  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Novo associado"
        description="Preencha as 5 etapas do cadastro"
      />
      <MemberForm mode="create" plans={plans} />
    </div>
  );
}

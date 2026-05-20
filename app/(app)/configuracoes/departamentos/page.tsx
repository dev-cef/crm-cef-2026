import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { PageHeader } from "@/components/layout/page-header";
import { DeptList } from "@/components/modules/configuracoes/dept-list";

export const dynamic = "force-dynamic";

export default async function DepartamentosPage() {
  await requireAdmin();

  const departments = await prisma.department.findMany({
    include: {
      _count: { select: { users: true } },
      permissions: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departamentos"
        description="Gerencie os departamentos e configure as permissões de acesso de cada um aos módulos do CRM."
      />
      <DeptList departments={departments} />
    </div>
  );
}

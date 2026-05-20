import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TotpSetup } from "@/components/modules/configuracoes/totp-setup";
import { UserRoleDeptRow } from "@/components/modules/configuracoes/user-role-dept-row";
import { CreateUserDialog } from "@/components/modules/configuracoes/create-user-dialog";

export const dynamic = "force-dynamic";

export default async function SegurancaPage() {
  const admin = await requireAdmin();

  const [dbUser, users, departments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: admin.id },
      select: { totpEnabled: true },
    }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departments: { select: { departmentId: true } },
      },
    }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Segurança" />

      {/* ── Usuários do sistema ── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Usuários do sistema</CardTitle>
            <CardDescription>
              Gerencie o papel e o departamento de cada usuário. Usuários com papel
              <strong> Departamento</strong> só enxergam associados vinculados ao seu
              departamento.
            </CardDescription>
          </div>
          <CreateUserDialog departments={departments} />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Usuário</th>
                  <th className="px-4 py-2.5 text-left">Papel atual</th>
                  <th className="px-4 py-2.5 text-left">Alterar papel</th>
                  <th className="px-4 py-2.5 text-left">Departamento</th>
                  <th className="px-4 py-2.5 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <UserRoleDeptRow
                    key={u.id}
                    userId={u.id}
                    name={u.name}
                    email={u.email}
                    role={u.role}
                    currentDeptId={u.departments[0]?.departmentId ?? null}
                    departments={departments}
                    isSelf={u.id === admin.id}
                  />
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum usuário cadastrado.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── 2FA ── */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Verificação em duas etapas (2FA)</CardTitle>
          <CardDescription>
            Protege o acesso de administrador com um código temporário (TOTP)
            de um app autenticador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TotpSetup enabled={dbUser?.totpEnabled ?? false} />
        </CardContent>
      </Card>
    </div>
  );
}

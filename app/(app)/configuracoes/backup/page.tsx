import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BackupDownloadButton } from "@/components/modules/configuracoes/backup-download-button";
import { RestoreSection } from "@/components/modules/configuracoes/restore-section";
import {
  Database,
  Users,
  CreditCard,
  CalendarDays,
  Wallet,
  ScrollText,
  ShieldAlert,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BackupPage() {
  await requireAdmin();

  const [
    memberCount,
    planCount,
    paymentCount,
    transactionCount,
    eventCount,
    userCount,
    auditCount,
  ] = await Promise.all([
    prisma.member.count({ where: { deletedAt: null } }),
    prisma.plan.count(),
    prisma.payment.count(),
    prisma.transaction.count(),
    prisma.event.count(),
    prisma.user.count(),
    prisma.auditLog.count(),
  ]);

  const stats = [
    { label: "Associados", value: memberCount, icon: Users },
    { label: "Pagamentos", value: paymentCount, icon: CreditCard },
    { label: "Transações", value: transactionCount, icon: Wallet },
    { label: "Eventos", value: eventCount, icon: CalendarDays },
    { label: "Planos", value: planCount, icon: Database },
    { label: "Usuários", value: userCount, icon: Users },
    { label: "Logs de auditoria", value: auditCount, icon: ScrollText },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Backup de dados" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 pt-5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <div>
                <p className="text-2xl font-semibold">{value.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Exportar backup completo</CardTitle>
          <CardDescription>
            Gera um arquivo JSON com todos os dados do sistema. O download
            é registrado no log de auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2">
            <p className="font-medium">O backup inclui:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Associados, planos, pagamentos e transações</li>
              <li>Eventos e inscrições</li>
              <li>Departamentos e permissões</li>
              <li>Usuários do sistema (sem senhas)</li>
              <li>Logs de auditoria completos</li>
            </ul>
            <div className="flex items-start gap-2 pt-1 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="size-4 mt-0.5 shrink-0" />
              <p className="text-xs">
                Senhas, segredos TOTP e códigos de recuperação são
                <strong> excluídos</strong> por segurança.
              </p>
            </div>
          </div>
          <BackupDownloadButton />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Restaurar backup</CardTitle>
          <CardDescription>
            Carregue um arquivo de backup para restaurar os dados. Os registros
            existentes serão sobrescritos; novos usuários são ignorados (sem senha).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RestoreSection />
        </CardContent>
      </Card>
    </div>
  );
}

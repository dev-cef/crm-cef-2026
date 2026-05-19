import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { toBrDate } from "@/lib/format";
import { formatCpf } from "@/lib/cpf";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApprovalActions } from "@/components/modules/configuracoes/approval-actions";

export const dynamic = "force-dynamic";

export default async function AprovacoesPage() {
  await requireAdmin();
  const pendentes = await prisma.user.findMany({
    where: { approved: false },
    orderBy: { createdAt: "asc" },
    include: {
      member: {
        select: {
          fullName: true,
          cpf: true,
          phone: true,
          registration: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Aprovações pendentes" />
      <Card>
        <CardHeader>
          <CardTitle>Contas aguardando aprovação</CardTitle>
          <CardDescription>
            Auto-cadastros feitos pelo site. Aprovar libera o login e ativa o
            associado; recusar remove o cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma conta pendente.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.member?.fullName ?? u.name}
                    </TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell className="text-sm">
                      {u.member ? formatCpf(u.member.cpf) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.member?.registration ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {toBrDate(u.createdAt)}
                    </TableCell>
                    <TableCell>
                      <ApprovalActions userId={u.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, BadgePercent, Calendar, Plus, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlanDialog } from "@/components/modules/financeiro/plan-dialog";
import { PlanActions } from "@/components/modules/financeiro/plan-actions";

export const dynamic = "force-dynamic";

const ENROLLMENT_FEE = 50;

export default async function PlanosPage() {
  const plans = await prisma.plan.findMany({
    orderBy: [{ billingPeriod: "asc" }, { name: "asc" }],
    include: { _count: { select: { members: true } } },
  });

  const mensais = plans.filter((p) => p.billingPeriod === "MENSAL");
  const anuais = plans.filter((p) => p.billingPeriod === "ANUAL");

  return (
    <div>
      <Link
        href="/financeiro"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Financeiro
      </Link>

      <PageHeader title="Planos" description={`${plans.length} plano(s) cadastrado(s)`}>
        <PlanDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> Novo plano
            </Button>
          }
        />
      </PageHeader>

      {/* Taxa de inscrição */}
      <Card className="mb-6 border-amber-500/40 bg-amber-500/5">
        <CardContent className="flex flex-wrap items-center gap-4 pt-4">
          <span className="flex size-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
            <BadgePercent className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold text-amber-700 dark:text-amber-400">
              Taxa de Inscrição — {formatBRL(ENROLLMENT_FEE)} (única)
            </p>
            <p className="text-sm text-muted-foreground">
              Obrigatória para todo novo associado. Inclui a carteirinha e já cobre a mensalidade do primeiro mês.
            </p>
          </div>
          <div className="flex flex-col gap-1 text-right text-xs text-muted-foreground">
            <span>Plano mensal individual: R$ 50 → 1º mês incluso</span>
            <span>Plano anual individual: R$ 50 + R$ 200 = <strong>R$ 250</strong></span>
            <span>Plano anual família: R$ 50 + R$ 300 = <strong>R$ 350</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Planos mensais */}
      <PlanTable
        title="Planos Mensais"
        icon={<Users className="size-4" />}
        plans={mensais}
        suffix="/mês"
      />

      {/* Planos anuais */}
      <div className="mt-6">
        <PlanTable
          title="Planos Anuais"
          icon={<Calendar className="size-4" />}
          plans={anuais}
          suffix="/ano"
          note="Equivalente a 10 mensalidades — 2 meses de economia."
        />
      </div>
    </div>
  );
}

type PlanRow = {
  id: string;
  name: string;
  monthlyPrice: number;
  billingPeriod: string;
  description: string | null;
  active: boolean;
  _count: { members: number };
};

function PlanTable({
  title,
  icon,
  plans,
  suffix,
  note,
}: {
  title: string;
  icon: React.ReactNode;
  plans: PlanRow[];
  suffix: string;
  note?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {note && (
          <span className="text-xs text-muted-foreground">· {note}</span>
        )}
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="hidden md:table-cell">Descrição</TableHead>
              <TableHead>Associados</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  Nenhum plano {title.toLowerCase()} cadastrado.
                </TableCell>
              </TableRow>
            )}
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <span className="font-mono">{formatBRL(p.monthlyPrice)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">{suffix}</span>
                </TableCell>
                <TableCell className="hidden max-w-xs truncate text-sm text-muted-foreground md:table-cell">
                  {p.description ?? "—"}
                </TableCell>
                <TableCell>{p._count.members}</TableCell>
                <TableCell>
                  <Badge variant={p.active ? "default" : "secondary"}>
                    {p.active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <PlanActions
                    plan={{
                      id: p.id,
                      name: p.name,
                      monthlyPrice: p.monthlyPrice,
                      billingPeriod: p.billingPeriod,
                      description: p.description,
                      active: p.active,
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default async function PlanosPage() {
  const plans = await prisma.plan.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { members: true } } },
  });

  return (
    <div>
      <Link
        href="/financeiro"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Financeiro
      </Link>

      <PageHeader title="Planos" description={`${plans.length} plano(s)`}>
        <PlanDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" /> Novo plano
            </Button>
          }
        />
      </PageHeader>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Valor mensal</TableHead>
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
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhum plano cadastrado.
                </TableCell>
              </TableRow>
            )}
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>{formatBRL(p.monthlyPrice)}</TableCell>
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

import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { formatBRL, formatDate, monthName } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LaunchMonthly } from "@/components/modules/financeiro/launch-monthly";
import { PaymentStatus } from "@/components/modules/financeiro/payment-status";
import { CountUp } from "@/components/unlumen-ui/count-up";
import { CardBeam } from "@/components/ui/card-beam";

export const dynamic = "force-dynamic";

const selectCls =
  "h-9 rounded-md border bg-background px-3 text-sm outline-none";

const BADGE: Record<string, "default" | "secondary" | "destructive"> = {
  PAGO: "default",
  PENDENTE: "secondary",
  ATRASADO: "destructive",
};

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    year?: string;
    planId?: string;
    status?: string;
  }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const month = Math.min(
    12,
    Math.max(1, Number(sp.month ?? now.getMonth() + 1) || now.getMonth() + 1),
  );
  const year = Number(sp.year ?? now.getFullYear()) || now.getFullYear();
  const planId = sp.planId ?? "ALL";
  const status = sp.status ?? "ALL";

  const where: Record<string, unknown> = {
    referenceMonth: month,
    referenceYear: year,
  };
  if (planId !== "ALL") where.planId = planId;
  if (["PAGO", "PENDENTE", "ATRASADO"].includes(status)) where.status = status;

  const [plans, payments] = await Promise.all([
    prisma.plan.findMany({ orderBy: { name: "asc" } }),
    prisma.payment.findMany({
      where,
      include: {
        member: { select: { id: true, fullName: true } },
        plan: { select: { name: true } },
      },
      orderBy: { member: { fullName: "asc" } },
    }),
  ]);

  const received = payments
    .filter((p) => p.status === "PAGO")
    .reduce((s, p) => s + p.amount, 0);
  const toReceive = payments
    .filter((p) => p.status !== "PAGO")
    .reduce((s, p) => s + p.amount, 0);
  const overdue = payments.filter((p) => p.status === "ATRASADO").length;

  const years = Array.from(
    { length: 5 },
    (_, i) => now.getFullYear() - 2 + i,
  );

  const qs = new URLSearchParams();
  qs.set("month", String(month));
  qs.set("year", String(year));
  if (planId !== "ALL") qs.set("planId", planId);
  if (status !== "ALL") qs.set("status", status);

  return (
    <div>
      <Link
        href="/financeiro"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Financeiro
      </Link>

      <PageHeader
        title="Pagamentos"
        description={`${monthName(month)} / ${year}`}
      >
        <Link
          href={`/financeiro/pagamentos/export?${qs.toString()}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          prefetch={false}
        >
          <Download className="size-4" /> Exportar CSV
        </Link>
        <LaunchMonthly
          month={month}
          year={year}
          label={`${monthName(month)}/${year}`}
        />
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="group relative overflow-hidden">
          <CardBeam />
          <CardHeader className="pb-1">
            <CardDescription>Arrecadado</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-xl font-semibold">
              <span className="mr-1 text-sm text-muted-foreground">R$</span>
              <CountUp
                to={Math.round(received)}
                duration={1.3}
                digitEffect="none"
                separator="."
              />
            </p>
          </CardContent>
        </Card>
        <Card className="group relative overflow-hidden">
          <CardBeam />
          <CardHeader className="pb-1">
            <CardDescription>A receber</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-xl font-semibold">
              <span className="mr-1 text-sm text-muted-foreground">R$</span>
              <CountUp
                to={Math.round(toReceive)}
                duration={1.3}
                digitEffect="none"
                separator="."
              />
            </p>
          </CardContent>
        </Card>
        <Card className="group relative overflow-hidden">
          <CardBeam />
          <CardHeader className="pb-1">
            <CardDescription>Inadimplentes (atrasados)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-display text-xl font-semibold">
              <CountUp to={overdue} duration={1.3} digitEffect="none" />
            </p>
          </CardContent>
        </Card>
      </div>

      <form
        method="get"
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <select name="month" defaultValue={String(month)} className={selectCls}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </select>
        <select name="year" defaultValue={String(year)} className={selectCls}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select name="planId" defaultValue={planId} className={selectCls}>
          <option value="ALL">Todos os planos</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className={selectCls}>
          <option value="ALL">Todos os status</option>
          <option value="PAGO">Pago</option>
          <option value="PENDENTE">Pendente</option>
          <option value="ATRASADO">Atrasado</option>
        </select>
        <Button type="submit" variant="secondary" size="sm">
          Filtrar
        </Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Associado</TableHead>
              <TableHead className="hidden sm:table-cell">Plano</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead className="hidden md:table-cell">Vencimento</TableHead>
              <TableHead className="hidden md:table-cell">Pago em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Alterar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhum pagamento neste período. Use “Lançar mensalidade”.
                </TableCell>
              </TableRow>
            )}
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link
                    href={`/associados/${p.member.id}`}
                    className="font-medium hover:underline"
                  >
                    {p.member.fullName}
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {p.plan?.name ?? "—"}
                </TableCell>
                <TableCell>{formatBRL(p.amount)}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {formatDate(p.dueDate)}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {p.paidAt ? formatDate(p.paidAt) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={BADGE[p.status] ?? "secondary"}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <PaymentStatus id={p.id} status={p.status} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

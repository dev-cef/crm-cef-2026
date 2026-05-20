import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  CircleDollarSign,
  CreditCard,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { monthName } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { CountUp } from "@/components/unlumen-ui/count-up";
import { CardBeam } from "@/components/ui/card-beam";
import { LaunchMonthly } from "@/components/modules/financeiro/launch-monthly";
import { ServerPermissionGate } from "@/components/auth/ServerPermissionGate";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  const [caixaTx] = await Promise.all([
    prisma.transaction.findMany({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      select: { type: true, amount: true },
    }),
  ]);

  const caixaEntradas = caixaTx.filter((t) => t.type === "ENTRADA").reduce((s, t) => s + t.amount, 0);
  const caixaSaidas = caixaTx.filter((t) => t.type === "SAIDA").reduce((s, t) => s + t.amount, 0);
  const caixaSaldo = caixaEntradas - caixaSaidas;

  const monthPayments = await prisma.payment.findMany({
    where: { referenceMonth: month, referenceYear: year },
    select: { amount: true, status: true },
  });
  const overdue = await prisma.payment.count({
    where: { status: "ATRASADO" },
  });

  const received = monthPayments
    .filter((p) => p.status === "PAGO")
    .reduce((s, p) => s + p.amount, 0);
  const toReceive = monthPayments
    .filter((p) => p.status !== "PAGO")
    .reduce((s, p) => s + p.amount, 0);

  const stats = [
    {
      label: `Arrecadado em ${monthName(month)}`,
      num: received,
      kind: "currency" as const,
      icon: CircleDollarSign,
    },
    {
      label: "A receber no mês",
      num: toReceive,
      kind: "currency" as const,
      icon: TrendingUp,
    },
    {
      label: "Pagamentos atrasados",
      num: overdue,
      kind: "count" as const,
      icon: AlertTriangle,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Resumo financeiro do clube"
      >
        <ServerPermissionGate module="financeiro" action="create">
          <LaunchMonthly
            month={month}
            year={year}
            label={`${monthName(month)}/${year}`}
            buttonLabel="Lançar Valores"
          />
        </ServerPermissionGate>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card
            key={s.label}
            className="group relative overflow-hidden"
          >
            <CardBeam />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{s.label}</CardDescription>
              <s.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="font-display text-2xl font-semibold">
                {s.kind === "currency" ? (
                  <>
                    <span className="mr-1 text-base text-muted-foreground">
                      R$
                    </span>
                    <CountUp
                      to={Math.round(s.num)}
                      duration={1.4}
                      digitEffect="none"
                      separator="."
                    />
                  </>
                ) : (
                  <CountUp
                    to={s.num}
                    duration={1.4}
                    digitEffect="none"
                    separator="."
                  />
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Caixa — resumo do mês */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Entradas do mês", value: caixaEntradas, icon: ArrowUpCircle, color: "text-green-600 dark:text-green-400" },
          { label: "Saídas do mês",   value: caixaSaidas,   icon: ArrowDownCircle, color: "text-destructive" },
          { label: "Saldo do mês",    value: caixaSaldo,    icon: Wallet, color: caixaSaldo >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive" },
        ].map((s) => (
          <Link key={s.label} href="/financeiro/caixa">
            <Card className="group relative overflow-hidden transition-colors hover:bg-accent/40">
              <CardBeam />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{s.label}</CardDescription>
                <s.icon className={cn("size-4", s.color)} />
              </CardHeader>
              <CardContent>
                <p className={cn("font-display text-2xl font-semibold", s.color)}>
                  <span className="mr-1 text-base text-muted-foreground">R$</span>
                  <CountUp to={Math.round(Math.abs(s.value))} duration={1.4} digitEffect="none" separator="." />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link href="/financeiro/caixa">
          <Card className="group relative overflow-hidden transition-colors hover:bg-accent/40">
            <CardBeam />
            <CardContent className="flex items-center gap-4 py-6">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wallet className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Caixa</p>
                <p className="text-sm text-muted-foreground">Entradas e saídas do clube</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/financeiro/planos">
          <Card className="group relative overflow-hidden transition-colors hover:bg-accent/40">
            <CardBeam />
            <CardContent className="flex items-center gap-4 py-6">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CreditCard className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Planos</p>
                <p className="text-sm text-muted-foreground">
                  Gerenciar planos e valores
                </p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/financeiro/pagamentos">
          <Card className="group relative overflow-hidden transition-colors hover:bg-accent/40">
            <CardBeam />
            <CardContent className="flex items-center gap-4 py-6">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Wallet className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Pagamentos</p>
                <p className="text-sm text-muted-foreground">
                  Lançar mensalidades e controlar inadimplência
                </p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </div>

    </div>
  );
}

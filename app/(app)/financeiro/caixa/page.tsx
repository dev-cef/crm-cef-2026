import Link from "next/link";
import {
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { formatBRL, toBrDate, monthName } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
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
import { CountUp } from "@/components/unlumen-ui/count-up";
import { CardBeam } from "@/components/ui/card-beam";
import { TransactionDialog } from "@/components/modules/financeiro/transaction-dialog";
import { TransactionRowActions } from "@/components/modules/financeiro/transaction-row-actions";
import { CaixaPeriodFilter } from "@/components/modules/financeiro/caixa-period-filter";
import { ServerPermissionGate } from "@/components/auth/ServerPermissionGate";

export const dynamic = "force-dynamic";

export default async function CaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();

  // Period "ALL" | "M-YYYY"
  const period = sp.period ?? `${now.getMonth() + 1}-${now.getFullYear()}`;
  const typeFilter = sp.type === "ENTRADA" || sp.type === "SAIDA" ? sp.type : "ALL";

  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  if (period !== "ALL") {
    const parts = period.split("-");
    const m = Number(parts[0]);
    const y = Number(parts[1]);
    if (m >= 1 && m <= 12 && y > 2000) {
      dateFilter = {
        gte: new Date(Date.UTC(y, m - 1, 1)),
        lte: new Date(Date.UTC(y, m, 0, 23, 59, 59)),
      };
    }
  }

  const where = {
    ...(dateFilter ? { date: dateFilter } : {}),
    ...(typeFilter !== "ALL" ? { type: typeFilter } : {}),
  };

  // Totals always without type filter but respecting period
  const [allTx, transactions] = await Promise.all([
    prisma.transaction.findMany({
      where: dateFilter ? { date: dateFilter } : {},
      select: { type: true, amount: true },
    }),
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
    }),
  ]);

  const totalEntradas = allTx
    .filter((t) => t.type === "ENTRADA")
    .reduce((s, t) => s + t.amount, 0);
  const totalSaidas = allTx
    .filter((t) => t.type === "SAIDA")
    .reduce((s, t) => s + t.amount, 0);
  const saldo = totalEntradas - totalSaidas;

  // Period options
  const periodOptions = [
    { value: "ALL", label: "Todo o período" },
    ...Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      return { value: `${m}-${y}`, label: `${monthName(m)} ${y}` };
    }),
  ];

  function buildHref(p?: string, t?: string) {
    const params = new URLSearchParams();
    if (p) params.set("period", p);
    if (t && t !== "ALL") params.set("type", t);
    const s = params.toString();
    return `/financeiro/caixa${s ? `?${s}` : ""}`;
  }

  const stats = [
    {
      label: "Entradas",
      value: totalEntradas,
      color: "text-green-600 dark:text-green-400",
      icon: ArrowUpCircle,
      iconColor: "text-green-600",
    },
    {
      label: "Saídas",
      value: totalSaidas,
      color: "text-destructive",
      icon: ArrowDownCircle,
      iconColor: "text-destructive",
    },
    {
      label: "Saldo",
      value: saldo,
      color: saldo >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive",
      icon: Wallet,
      iconColor: saldo >= 0 ? "text-green-600" : "text-destructive",
    },
  ];

  return (
    <div>
      <Link
        href="/financeiro"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Financeiro
      </Link>

      <PageHeader
        title="Caixa"
        description="Controle de entradas e saídas do clube"
      >
        <ServerPermissionGate module="financeiro" action="create">
          <TransactionDialog defaultType="SAIDA" />
        </ServerPermissionGate>
        <ServerPermissionGate module="financeiro" action="create">
          <TransactionDialog defaultType="ENTRADA" />
        </ServerPermissionGate>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s, i) => (
          <Card
            key={s.label}
            className="group relative overflow-hidden border-border/70"
            style={{ "--i": i + 1 } as React.CSSProperties}
          >
            <CardBeam />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{s.label}</CardDescription>
              <s.icon className={cn("size-4", s.iconColor)} />
            </CardHeader>
            <CardContent>
              <p className={cn("font-display text-2xl font-semibold", s.color)}>
                <span className="mr-1 text-base text-muted-foreground">R$</span>
                <CountUp
                  to={Math.round(Math.abs(s.value))}
                  duration={1.2}
                  digitEffect="none"
                  separator="."
                />
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <CaixaPeriodFilter
          period={period}
          type={typeFilter}
          options={periodOptions}
        />

        {/* Type chips */}
        {(["ALL", "ENTRADA", "SAIDA"] as const).map((t) => (
          <Link
            key={t}
            href={buildHref(period, t)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              typeFilter === t
                ? t === "ENTRADA"
                  ? "border-green-600 bg-green-600/10 text-green-700 dark:text-green-400"
                  : t === "SAIDA"
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {t === "ALL" ? "Todos" : t === "ENTRADA" ? "Entradas" : "Saídas"}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="mt-4 rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nenhuma transação registrada para este período.
                </TableCell>
              </TableRow>
            )}
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="tabular-nums text-sm">
                  {toBrDate(t.date)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={t.type === "ENTRADA" ? "default" : "destructive"}
                    className={
                      t.type === "ENTRADA"
                        ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
                        : ""
                    }
                  >
                    {t.type === "ENTRADA" ? "Entrada" : "Saída"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <span>{t.category}</span>
                  {t.subcategory && (
                    <p className="text-xs text-muted-foreground/70">{t.subcategory}</p>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  <span>{t.description}</span>
                  {t.payerName && (
                    <p className="text-xs text-muted-foreground">{t.payerName}</p>
                  )}
                  {t.paymentMethod && (
                    <p className="text-xs text-muted-foreground">{t.paymentMethod}</p>
                  )}
                  {t.notes && (
                    <p className="text-xs text-muted-foreground italic">{t.notes}</p>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums",
                    t.type === "ENTRADA"
                      ? "text-green-700 dark:text-green-400"
                      : "text-destructive",
                  )}
                >
                  {t.type === "SAIDA" ? "−" : "+"}
                  {formatBRL(t.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <TransactionRowActions
                    id={t.id}
                    initial={{
                      type: t.type as "ENTRADA" | "SAIDA",
                      category: t.category,
                      subcategory: t.subcategory ?? "",
                      description: t.description,
                      amount: t.amount,
                      date: toBrDate(t.date),
                      competenceMonth: t.competenceMonth ?? null,
                      competenceYear: t.competenceYear ?? null,
                      clubAccount: t.clubAccount ?? "",
                      payerName: t.payerName ?? "",
                      linkedActivity: t.linkedActivity ?? "",
                      paymentMethod: t.paymentMethod ?? "",
                      notes: t.notes ?? "",
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

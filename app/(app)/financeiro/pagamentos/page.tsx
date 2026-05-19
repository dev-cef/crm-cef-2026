import Link from "next/link";
import { ArrowLeft, Check, Download, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { formatBRL, formatDate, monthName } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LaunchMonthly } from "@/components/modules/financeiro/launch-monthly";
import { PaymentRowActions } from "@/components/modules/financeiro/payment-row-actions";
import { PaymentPeriodFilter } from "@/components/modules/financeiro/payment-period-filter";
import { PaymentSearch } from "@/components/modules/financeiro/payment-search";
import { CountUp } from "@/components/unlumen-ui/count-up";
import { CardBeam } from "@/components/ui/card-beam";

export const dynamic = "force-dynamic";

const ALL_STATUSES = ["PAGO", "PENDENTE", "ATRASADO"] as const;
type Status = (typeof ALL_STATUSES)[number];

const BADGE: Record<string, "default" | "secondary" | "destructive"> = {
  PAGO: "default",
  PENDENTE: "secondary",
  ATRASADO: "destructive",
};

const BADGE_LABEL: Record<string, string> = {
  PAGO: "Pago",
  PENDENTE: "Pendente",
  ATRASADO: "Atrasado",
};

export default async function PagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    statuses?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const now = new Date();

  // Period param: "ALL" | "M-YYYY"
  const period = sp.period ?? "ALL";

  // Parse active statuses (comma-separated, default = all)
  const rawStatuses = sp.statuses?.split(",").filter((s): s is Status =>
    (ALL_STATUSES as readonly string[]).includes(s),
  ) ?? [...ALL_STATUSES];
  const activeStatuses: Status[] = rawStatuses.length > 0 ? rawStatuses : [...ALL_STATUSES];

  const q = sp.q?.trim() ?? "";

  // Build month/year filter
  let monthFilter: { referenceMonth: number; referenceYear: number } | undefined;
  if (period !== "ALL") {
    const parts = period.split("-");
    const m = Number(parts[0]);
    const y = Number(parts[1]);
    if (m >= 1 && m <= 12 && y > 2000) {
      monthFilter = { referenceMonth: m, referenceYear: y };
    }
  }

  // DB where clause
  const memberWhere = q
    ? { OR: [{ fullName: { contains: q } }, { cpf: { contains: q } }, { email: { contains: q } }] }
    : undefined;

  const baseWhere = {
    ...(monthFilter ?? {}),
    member: { ...memberWhere, deletedAt: null },
  };

  // Fetch totals per status (for cards, always without status filter)
  const [totals, payments] = await Promise.all([
    prisma.payment.groupBy({
      by: ["status"],
      _sum: { amount: true },
      where: baseWhere,
    }),
    prisma.payment.findMany({
      where: {
        ...baseWhere,
        status: { in: activeStatuses },
      },
      include: {
        member: { select: { id: true, fullName: true, cpf: true } },
        plan: { select: { name: true } },
        // notes incluído para distinguir taxa de inscrição de mensalidade no recibo
      },
      // notes já vem no select padrão do Payment
      orderBy: [{ dueDate: "desc" }, { member: { fullName: "asc" } }],
    }),
  ]);

  const totalByStatus = (status: Status) =>
    totals.find((t) => t.status === status)?._sum?.amount ?? 0;

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

  // Build toggle URL for stat cards
  function toggleUrl(status: Status) {
    const p = new URLSearchParams();
    p.set("period", period);
    if (q) p.set("q", q);
    const next = activeStatuses.includes(status)
      ? activeStatuses.filter((s) => s !== status)
      : [...activeStatuses, status];
    if (next.length < ALL_STATUSES.length) p.set("statuses", next.join(","));
    return `/financeiro/pagamentos?${p}`;
  }

  const allActive = activeStatuses.length === ALL_STATUSES.length;
  const statusText = allActive
    ? "Exibindo todos os status. Desmarque os cards acima para filtrar."
    : `Exibindo: ${activeStatuses.map((s) => BADGE_LABEL[s]).join(", ")}.`;

  // Export qs
  const exportParams = new URLSearchParams();
  if (period !== "ALL" && monthFilter) {
    exportParams.set("month", String(monthFilter.referenceMonth));
    exportParams.set("year", String(monthFilter.referenceYear));
  }
  if (activeStatuses.length < ALL_STATUSES.length)
    exportParams.set("status", activeStatuses[0] ?? "ALL");

  // Launch monthly: use current month
  const launchMonth = monthFilter?.referenceMonth ?? now.getMonth() + 1;
  const launchYear = monthFilter?.referenceYear ?? now.getFullYear();

  return (
    <div>
      <Link
        href="/financeiro"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Financeiro
      </Link>

      <PageHeader title="Financeiro" description="Cobranças e histórico financeiro de todos os associados.">
        <Link
          href={`/financeiro/pagamentos/export?${exportParams}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          prefetch={false}
        >
          <Download className="size-4" /> Exportar CSV
        </Link>
        <LaunchMonthly
          month={launchMonth}
          year={launchYear}
          label={`${monthName(launchMonth)}/${launchYear}`}
        />
      </PageHeader>

      {/* Period filter */}
      <PaymentPeriodFilter
        period={period}
        statuses={activeStatuses.join(",")}
        q={q}
        options={periodOptions}
      />

      {/* Stat cards */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {(
          [
            { status: "PAGO" as Status, label: "Recebido" },
            { status: "PENDENTE" as Status, label: "Pendente" },
            { status: "ATRASADO" as Status, label: "Atrasado" },
          ] as const
        ).map(({ status, label }) => {
          const active = activeStatuses.includes(status);
          return (
            <Link key={status} href={toggleUrl(status)} className="group relative overflow-hidden rounded-xl">
              <Card
                className={cn(
                  "group relative h-full overflow-hidden transition-opacity",
                  !active && "opacity-40",
                )}
              >
                <CardBeam />
                <CardHeader className="pb-1 flex-row items-center justify-between">
                  <CardDescription className="text-xs font-medium uppercase tracking-wider">
                    {label}
                  </CardDescription>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border text-[10px]",
                      active
                        ? "border-green-500 bg-green-500/10 text-green-600"
                        : "border-muted-foreground/30",
                    )}
                  >
                    {active && <Check className="size-3" />}
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-xl font-semibold">
                    <span className="mr-1 text-sm text-muted-foreground">R$</span>
                    <CountUp
                      to={Math.round(totalByStatus(status))}
                      duration={1.1}
                      digitEffect="none"
                      separator="."
                    />
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Table section */}
      <div className="rounded-xl border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex-1">
            <h2 className="font-semibold">Cobranças &amp; Histórico Financeiro</h2>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <PaymentSearch period={period} statuses={activeStatuses.join(",")} q={q} />
          </div>
        </div>

        <div className="px-4 py-2">
          <p className="text-xs text-muted-foreground">{statusText}</p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Associado</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Pago em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {q
                    ? "Nenhum pagamento encontrado para esta busca."
                    : 'Nenhum pagamento neste período. Use "Lançar mensalidade".'}
                </TableCell>
              </TableRow>
            )}
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link
                    href={`/associados/${p.member.id}`}
                    className="inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    {p.member.fullName}
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{formatDate(p.dueDate)}</TableCell>
                <TableCell className="font-medium">{formatBRL(p.amount)}</TableCell>
                <TableCell>
                  <Badge variant={BADGE[p.status] ?? "secondary"}>
                    {BADGE_LABEL[p.status] ?? p.status}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-sm md:table-cell">
                  {p.paidAt ? formatDate(p.paidAt) : "—"}
                </TableCell>
                <TableCell>
                  <PaymentRowActions
                    id={p.id}
                    status={p.status}
                    memberName={p.member.fullName}
                    memberCpf={p.member.cpf}
                    planName={p.plan?.name ?? "—"}
                    amount={p.amount}
                    dueDate={p.dueDate.toISOString()}
                    paidAt={p.paidAt?.toISOString() ?? null}
                    receiptNumber={p.receiptNumber ?? null}
                    notes={p.notes ?? null}
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

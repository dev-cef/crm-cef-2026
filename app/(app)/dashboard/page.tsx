import Link from "next/link";
import {
  ArrowRight,
  Cake,
  CalendarPlus,
  CircleDollarSign,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { calculateAge, formatDateTime, monthName, toNum } from "@/lib/format";
import { labelFrom } from "@/lib/constants";
import { EVENT_DIFFICULTY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CountUp } from "@/components/unlumen-ui/count-up";
import { ConfettiHover } from "@/components/modules/dashboard/confetti-hover";
import { SexDonut } from "@/components/modules/dashboard/sex-donut";
import { AgeBars } from "@/components/modules/dashboard/age-bars";
import { RevenueBars } from "@/components/modules/dashboard/revenue-bars";
import { PaymentStatusDonut } from "@/components/modules/dashboard/payment-status-donut";
import { MemberGrowthBars } from "@/components/modules/dashboard/member-growth-bars";
import { ArpMetaGauge } from "@/components/modules/dashboard/arp-meta-gauge";
import { CardBeam } from "@/components/ui/card-beam";
import { getMetaArpAno } from "@/lib/events/arp";

export const dynamic = "force-dynamic";

function last6Months() {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return { year: d.getFullYear(), month: d.getMonth() + 1, label: d.toLocaleString("pt-BR", { month: "short" }) };
  });
}

async function getData() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const months6 = last6Months();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const [activeCount, sexGroups, members, monthPayments, upcomingEvents, revenuePayments, newMembersRaw, arpMeta] =
    await Promise.all([
      prisma.member.count({
        where: { status: "ACTIVE", deletedAt: null },
      }),
      prisma.member.groupBy({
        by: ["sex"],
        where: { status: "ACTIVE", deletedAt: null },
        _count: { _all: true },
      }),
      prisma.member.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          fullName: true,
          birthDate: true,
          status: true,
        },
      }),
      prisma.payment.findMany({
        where: { referenceMonth: month, referenceYear: year },
        select: { amount: true, status: true },
      }),
      prisma.event.findMany({
        where: { dateTime: { gte: now }, status: { not: "CANCELADO" } },
        orderBy: { dateTime: "asc" },
        take: 5,
        include: { _count: { select: { registrations: true } } },
      }),
      prisma.payment.findMany({
        where: {
          status: "PAGO",
          OR: months6.map((m) => ({ referenceYear: m.year, referenceMonth: m.month })),
        },
        select: { amount: true, referenceMonth: true, referenceYear: true },
      }),
      prisma.member.findMany({
        where: { createdAt: { gte: sixMonthsAgo }, deletedAt: null },
        select: { createdAt: true },
      }),
      getMetaArpAno(year),
    ]);

  const femaleCount =
    sexGroups.find((g) => g.sex === "F")?._count._all ?? 0;
  const maleCount =
    sexGroups.find((g) => g.sex === "M")?._count._all ?? 0;

  const decadeCounts = new Map<number, number>();
  for (const m of members) {
    if (m.status !== "ACTIVE") continue;
    const age = calculateAge(m.birthDate);
    if (age < 0) continue;
    const decade = Math.floor(age / 10) * 10;
    decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
  }
  const ageBands = [...decadeCounts.entries()]
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => a.decade - b.decade);

  const today = now.getDate();
  const birthdays = members
    .filter((m) => new Date(m.birthDate).getUTCMonth() + 1 === month)
    .map((m) => ({ name: m.fullName, day: new Date(m.birthDate).getUTCDate() }))
    .sort((a, b) => a.day - b.day);

  const todays = birthdays.filter((b) => b.day === today);
  const upcoming = birthdays.find((b) => b.day > today) ?? null;

  const received = monthPayments
    .filter((p) => p.status === "PAGO")
    .reduce((s, p) => s + toNum(p.amount), 0);
  const pending = monthPayments
    .filter((p) => p.status !== "PAGO")
    .reduce((s, p) => s + toNum(p.amount), 0);

  // Gráfico receita — últimos 6 meses
  const revenueBars = months6.map((m) => ({
    label: m.label,
    value: revenuePayments
      .filter((p) => p.referenceYear === m.year && p.referenceMonth === m.month)
      .reduce((s, p) => s + toNum(p.amount), 0),
  }));

  // Gráfico novos associados — últimos 6 meses
  const memberGrowthBars = months6.map((m) => {
    const start = new Date(m.year, m.month - 1, 1);
    const end = new Date(m.year, m.month, 1);
    return {
      label: m.label,
      value: newMembersRaw.filter((r) => r.createdAt >= start && r.createdAt < end).length,
    };
  });

  // Status de pagamentos do mês atual
  const pagoCount = monthPayments.filter((p) => p.status === "PAGO").length;
  const pendenteCount = monthPayments.filter((p) => p.status === "PENDENTE").length;
  const atrasadoCount = monthPayments.filter((p) => p.status === "ATRASADO").length;

  let birthdayMessage: string;
  if (todays.length > 0) {
    const extra =
      todays.length > 1 ? ` e +${todays.length - 1}` : "";
    birthdayMessage = `🎉 Hoje é aniversário de ${todays[0].name}${extra} — Parabéns!`;
  } else if (upcoming) {
    birthdayMessage = `Próximo: ${upcoming.name} (dia ${upcoming.day})`;
  } else if (birthdays.length > 0) {
    birthdayMessage = "Sem próximos aniversários este mês";
  } else {
    birthdayMessage = "Nenhum aniversariante este mês";
  }

  const yearEnd = new Date(year, 11, 31);
  const daysToYearEnd = Math.max(0, Math.ceil((yearEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  return {
    activeCount,
    femaleCount,
    maleCount,
    ageBands,
    birthdayCount: birthdays.length,
    birthdayMessage,
    birthdayToday: todays.length > 0,
    received,
    pending,
    upcomingEvents,
    month,
    revenueBars,
    memberGrowthBars,
    pagoCount,
    pendenteCount,
    atrasadoCount,
    arpMeta,
    daysToYearEnd,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  const sessionUser = toSessionUser(session!.user);
  const [canCreateMember, canCreateEvent] = await Promise.all([
    can(sessionUser, "associados", "create"),
    can(sessionUser, "eventos", "create"),
  ]);

  const data = await getData();

  const stats = [
    {
      label: "Associados ativos",
      num: data.activeCount,
      kind: "count" as const,
      icon: Users,
      href: "/associados",
      subtitle: undefined as string | undefined,
      celebrate: false,
      confetti: false,
    },
    {
      label: `Aniversariantes de ${monthName(data.month)}`,
      num: data.birthdayCount,
      kind: "count" as const,
      icon: Cake,
      href: "/aniversariantes",
      subtitle: data.birthdayMessage as string | undefined,
      celebrate: data.birthdayToday,
      confetti: data.birthdayToday,
    },
    {
      label: "Recebido no mês",
      num: data.received,
      kind: "currency" as const,
      icon: CircleDollarSign,
      href: "/financeiro",
      subtitle: undefined as string | undefined,
      celebrate: false,
      confetti: false,
    },
    {
      label: "A receber no mês",
      num: data.pending,
      kind: "currency" as const,
      icon: TrendingUp,
      href: "/financeiro",
      subtitle: undefined as string | undefined,
      celebrate: false,
      confetti: false,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão geral do Clube Excursionista de Friburgo"
      >
        {canCreateMember && (
          <Link
            href="/associados/novo"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <UserPlus className="size-4" /> Novo associado
          </Link>
        )}
        {canCreateEvent && (
          <Link
            href="/eventos/novo"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <CalendarPlus className="size-4" /> Novo evento
          </Link>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <ConfettiHover
            key={s.label}
            active={s.confetti}
            className="cef-rise"
            style={{ "--i": i + 1 } as React.CSSProperties}
          >
            <Link href={s.href} className="block h-full">
              <Card
                className={cn(
                  "group relative h-full overflow-hidden border-border/70 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
                  s.celebrate && "border-primary/40 bg-primary/5",
                )}
              >
                <CardBeam />
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription>{s.label}</CardDescription>
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <s.icon className="size-4" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-semibold tracking-tight">
                    {s.kind === "currency" ? (
                      <>
                        <span className="mr-1 text-xl text-muted-foreground">
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
                  {s.subtitle && (
                    <p
                      className={cn(
                        "mt-1 truncate text-xs",
                        s.celebrate
                          ? "font-medium text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {s.subtitle}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          </ConfettiHover>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card
          className="cef-rise border-border/70 lg:col-span-1"
          style={{ "--i": 5 } as React.CSSProperties}
        >
          <CardHeader>
            <CardTitle>Associados por sexo</CardTitle>
            <CardDescription>
              Distribuição dos associados ativos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SexDonut female={data.femaleCount} male={data.maleCount} />
          </CardContent>
        </Card>

        <Card
          className="cef-rise border-border/70 lg:col-span-2"
          style={{ "--i": 6 } as React.CSSProperties}
        >
          <CardHeader>
            <CardTitle>Faixa etária</CardTitle>
            <CardDescription>
              Associados ativos por década de idade
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AgeBars bands={data.ageBands} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          className="cef-rise border-border/70 lg:col-span-2"
          style={{ "--i": 7 } as React.CSSProperties}
        >
          <CardHeader>
            <CardTitle>Receita mensal</CardTitle>
            <CardDescription>Pagamentos recebidos nos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueBars bars={data.revenueBars} />
          </CardContent>
        </Card>

        <Card
          className="cef-rise border-border/70"
          style={{ "--i": 8 } as React.CSSProperties}
        >
          <CardHeader>
            <CardTitle>Pagamentos do mês</CardTitle>
            <CardDescription>Status das cobranças de {monthName(data.month)}</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentStatusDonut
              pago={data.pagoCount}
              pendente={data.pendenteCount}
              atrasado={data.atrasadoCount}
            />
          </CardContent>
        </Card>
      </div>

      <Card
        className="cef-rise mt-4 border-border/70"
        style={{ "--i": 9 } as React.CSSProperties}
      >
        <CardHeader>
          <CardTitle>Novos associados</CardTitle>
          <CardDescription>Cadastros realizados nos últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberGrowthBars bars={data.memberGrowthBars} />
        </CardContent>
      </Card>

      <Card
        className="cef-rise mt-4 border-border/70"
        style={{ "--i": 10 } as React.CSSProperties}
      >
        <CardHeader>
          <CardTitle>Contrapartida ARP {data.arpMeta.ano}</CardTitle>
          <CardDescription>
            Meta anual de 6 eventos abertos ao público
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ArpMetaGauge {...data.arpMeta} />
          {data.arpMeta.status !== "atingida" && data.daysToYearEnd <= 60 && (
            <div className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
              data.arpMeta.status === "abaixo"
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-orange-300/50 bg-orange-50 text-orange-800 dark:border-orange-800/50 dark:bg-orange-950/30 dark:text-orange-300",
            )}>
              <span className="mt-0.5 shrink-0">⚠️</span>
              <div>
                <p className="font-medium">
                  {data.arpMeta.status === "abaixo" ? "Meta ARP em risco crítico" : "Meta ARP em risco"}
                </p>
                <p className="text-xs opacity-80">
                  Faltam {Math.max(0, data.arpMeta.meta - data.arpMeta.realizados)} evento{data.arpMeta.realizados === data.arpMeta.meta - 1 ? "" : "s"} para atingir a meta e restam apenas {data.daysToYearEnd} dias no ciclo {data.arpMeta.ano}.{" "}
                  <Link href="/eventos/novo" className="underline underline-offset-2">
                    Agendar evento ARP
                  </Link>
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card
        className="cef-rise mt-4 border-border/70"
        style={{ "--i": 11 } as React.CSSProperties}
      >
        <CardHeader>
          <CardTitle>Próximos eventos</CardTitle>
          <CardDescription>
            Atividades planejadas e confirmadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.upcomingEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum evento futuro cadastrado.
            </p>
          ) : (
            <ul className="divide-y">
              {data.upcomingEvents.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/eventos/${e.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {e.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.dateTime)} · {e.location}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">
                      {labelFrom(EVENT_DIFFICULTY, e.difficulty)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {e._count.registrations}/{e.slots} vagas
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Link
              href="/eventos"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Ver todos os eventos <ArrowRight className="size-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

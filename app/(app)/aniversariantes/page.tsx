import Link from "next/link";
import {
  AtSign,
  BarChart3,
  Cake,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Filter,
  MessageCircle,
  MessageSquareText,
  Pencil,
  Target,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { calculateAge, monthName } from "@/lib/format";
import { isBirthdayInPeriod, type BirthdayPeriod } from "@/lib/birthday";
import { cn } from "@/lib/utils";
import { getBirthdayConfig } from "@/app/(app)/aniversariantes/actions";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CountUp } from "@/components/unlumen-ui/count-up";
import { SexDonut } from "@/components/modules/dashboard/sex-donut";
import { AgeBars } from "@/components/modules/dashboard/age-bars";
import { MonthBars } from "@/components/modules/aniversariantes/month-bars";
import { ConfigForm } from "@/components/modules/aniversariantes/config-form";
import { DeleteMemberDialog } from "@/components/modules/associados/delete-member-dialog";

export const dynamic = "force-dynamic";

const FEMALE = "#e983b9";
const MALE = "#56b3d9";
const AMBER = "#dfae3c";
const selectCls =
  "h-9 rounded-md border bg-background px-3 text-sm outline-none";

function igUrl(handle: string): string {
  return `https://instagram.com/${handle.replace(/^@/, "").trim()}`;
}
function waUrl(num: string): string {
  const digits = num.replace(/\D/g, "");
  const intl = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${intl}`;
}

export default async function AniversariantesPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    month?: string;
    sex?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const today = new Date();
  const period = (
    ["dia", "semana", "mes"].includes(sp.period ?? "") ? sp.period : "mes"
  ) as BirthdayPeriod;
  const month = Math.min(
    12,
    Math.max(
      1,
      Number(sp.month ?? today.getMonth() + 1) || today.getMonth() + 1,
    ),
  );
  const sex = sp.sex === "M" || sp.sex === "F" ? sp.sex : "ALL";
  const q = (sp.q ?? "").trim();

  const [members, cfg, logs] = await Promise.all([
    prisma.member.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        fullName: true,
        sex: true,
        phone: true,
        instagram: true,
        whatsapp: true,
        photoUrl: true,
        birthDate: true,
      },
    }),
    getBirthdayConfig(),
    prisma.birthdayMessageLog.findMany({
      orderBy: { sentAt: "desc" },
      take: 30,
      include: { member: { select: { fullName: true } } },
    }),
  ]);

  const sortByDate = <T extends { birthDate: Date }>(arr: T[]) =>
    [...arr].sort((a, b) => {
      const da = new Date(a.birthDate);
      const db = new Date(b.birthDate);
      return (
        da.getUTCMonth() - db.getUTCMonth() ||
        da.getUTCDate() - db.getUTCDate()
      );
    });

  const inPeriod = members.filter((m) =>
    isBirthdayInPeriod(new Date(m.birthDate), period, month, today),
  );
  const list = sortByDate(
    inPeriod
      .filter((m) => (sex === "ALL" ? true : m.sex === sex))
      .filter((m) =>
        q ? m.fullName.toLowerCase().includes(q.toLowerCase()) : true,
      ),
  );

  const totalPeriod = inPeriod.length;
  const female = list.filter((m) => m.sex === "F").length;
  const male = list.filter((m) => m.sex === "M").length;
  const femalePct = list.length ? Math.round((female / list.length) * 100) : 0;
  const malePct = list.length ? 100 - femalePct : 0;
  const avgAge = list.length
    ? Math.round(
        list.reduce((s, m) => s + calculateAge(new Date(m.birthDate)), 0) /
          list.length,
      )
    : 0;

  // distribuição anual (todos os associados, independe dos filtros)
  const monthCounts = Array.from({ length: 12 }, () => 0);
  for (const m of members) {
    monthCounts[new Date(m.birthDate).getUTCMonth()]++;
  }

  // faixa etária da lista filtrada
  const decadeMap = new Map<number, number>();
  for (const m of list) {
    const age = calculateAge(new Date(m.birthDate));
    if (age < 0) continue;
    const dec = Math.floor(age / 10) * 10;
    decadeMap.set(dec, (decadeMap.get(dec) ?? 0) + 1);
  }
  const ageBands = [...decadeMap.entries()]
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => a.decade - b.decade);

  const query = new URLSearchParams({
    period,
    month: String(month),
    sex,
    ...(q ? { q } : {}),
  }).toString();

  const stats: {
    label: string;
    value: number;
    sub?: string;
    color: string;
    icon?: React.ComponentType<{ className?: string }>;
    glyph?: string;
  }[] = [
    { label: "Total", value: totalPeriod, color: AMBER, icon: Users },
    {
      label: "Feminino",
      value: female,
      sub: `${femalePct}%`,
      color: FEMALE,
      glyph: "♀",
    },
    {
      label: "Masculino",
      value: male,
      sub: `${malePct}%`,
      color: MALE,
      glyph: "♂",
    },
    { label: "Idade média", value: avgAge, color: AMBER, icon: Target },
    {
      label: "Filtrados",
      value: list.length,
      sub: `de ${totalPeriod}`,
      color: AMBER,
      icon: BarChart3,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Aniversariantes"
        description="Análise e gestão dos aniversariantes do clube"
      >
        <Link
          href="/associados/novo"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <UserPlus className="size-4" /> Novo associado
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s, i) => (
          <Card
            key={s.label}
            className="cef-rise border-border/70"
            style={{ "--i": i + 1 } as React.CSSProperties}
          >
            <CardContent className="pt-1">
              <span
                className="inline-flex text-lg"
                style={{ color: s.color }}
              >
                {s.glyph ? (
                  <span className="font-semibold leading-none">
                    {s.glyph}
                  </span>
                ) : s.icon ? (
                  <s.icon className="size-5" />
                ) : null}
              </span>
              <p
                className="mt-3 font-display text-4xl font-bold tracking-tight"
                style={{ color: s.color }}
              >
                <CountUp to={s.value} duration={1.2} digitEffect="none" />
              </p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              {s.sub && (
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          className="cef-rise border-border/70"
          style={{ "--i": 6 } as React.CSSProperties}
        >
          <CardContent className="pt-1">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Por mês
            </p>
            <MonthBars counts={monthCounts} />
          </CardContent>
        </Card>

        <Card
          className="cef-rise border border-[#dfae3c]/50"
          style={{ "--i": 7 } as React.CSSProperties}
        >
          <CardContent className="pt-1">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Por sexo
            </p>
            <SexDonut female={female} male={male} />
          </CardContent>
        </Card>

        <Card
          className="cef-rise border-border/70"
          style={{ "--i": 8 } as React.CSSProperties}
        >
          <CardContent className="pt-1">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Faixa etária
            </p>
            <AgeBars bands={ageBands} />
          </CardContent>
        </Card>
      </div>

      <Card
        className="cef-rise mt-4 border-border/70"
        style={{ "--i": 9 } as React.CSSProperties}
      >
        <CardContent className="pt-4">
          <form
            method="get"
            className="flex flex-wrap items-center gap-2"
          >
            <select name="period" defaultValue={period} className={selectCls}>
              <option value="dia">Hoje</option>
              <option value="semana">Próximos 7 dias</option>
              <option value="mes">Por mês</option>
            </select>
            <select
              name="month"
              defaultValue={String(month)}
              className={selectCls}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthName(m)}
                </option>
              ))}
            </select>
            <select name="sex" defaultValue={sex} className={selectCls}>
              <option value="ALL">Todos os sexos</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar nome…"
              className={cn(selectCls, "min-w-44 flex-1")}
            />
            <Button type="submit" variant="secondary" size="sm">
              <Filter className="size-4" /> Filtrar
            </Button>
            <Link
              href={`/aniversariantes/export?${query}&format=csv`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <FileSpreadsheet className="size-4" /> Exportar Excel
            </Link>
            <Link
              href={`/aniversariantes/export?${query}&format=txt`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <FileText className="size-4" />{" "}
              {period === "mes" ? monthName(month) : "Lista"} (.txt)
            </Link>
          </form>
        </CardContent>
      </Card>

      <Card
        className="cef-rise mt-4 border-border/70"
        style={{ "--i": 10 } as React.CSSProperties}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cake className="size-4" />
            {list.length} resultado(s)
            {period === "mes" ? ` em ${monthName(month)}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-14">Dia</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    Mês <ChevronUp className="size-3" />
                  </span>
                </TableHead>
                <TableHead className="w-16">Idade</TableHead>
                <TableHead>Sexo</TableHead>
                <TableHead className="hidden md:table-cell">
                  Instagram
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  WhatsApp
                </TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum aniversariante para os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
              {list.map((m) => {
                const d = new Date(m.birthDate);
                const age = calculateAge(d);
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link
                        href={`/associados/${m.id}`}
                        className="flex items-center gap-3 font-medium hover:underline"
                      >
                        <Avatar className="size-8">
                          {m.photoUrl && (
                            <AvatarImage src={m.photoUrl} alt={m.fullName} />
                          )}
                          <AvatarFallback className="text-xs">
                            {m.fullName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{m.fullName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {String(d.getUTCDate()).padStart(2, "0")}
                    </TableCell>
                    <TableCell>{monthName(d.getUTCMonth() + 1)}</TableCell>
                    <TableCell className="tabular-nums">{age}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        style={{
                          color: m.sex === "F" ? FEMALE : MALE,
                        }}
                      >
                        {m.sex === "F" ? "Feminino" : "Masculino"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {m.instagram ? (
                        <a
                          href={igUrl(m.instagram)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm hover:underline"
                        >
                          <AtSign className="size-3.5" />
                          {m.instagram.startsWith("@")
                            ? m.instagram
                            : `@${m.instagram}`}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {m.whatsapp ? (
                        <a
                          href={waUrl(m.whatsapp)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm hover:underline"
                        >
                          <MessageCircle className="size-3.5" />
                          {m.whatsapp}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/associados/${m.id}/editar`}
                          className={cn(
                            buttonVariants({
                              variant: "ghost",
                              size: "icon-sm",
                            }),
                          )}
                          aria-label="Editar"
                        >
                          <Pencil className="size-4" />
                        </Link>
                        <DeleteMemberDialog
                          id={m.id}
                          name={m.fullName}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Excluir"
                              className="text-destructive"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareText className="size-4" /> Mensagem de parabéns
            </CardTitle>
            <CardDescription>
              {cfg.enabled
                ? "Envio automático ativado."
                : "Envio automático desativado."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigForm
              initialTemplate={cfg.template}
              initialEnabled={cfg.enabled}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Log de mensagens enviadas
            </CardTitle>
            <CardDescription>Últimos 30 envios</CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nenhuma mensagem enviada ainda.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {logs.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="truncate">{l.member.fullName}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Badge variant="secondary">{l.channel}</Badge>
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(l.sentAt))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Cake, MessageSquareText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { calculateAge, ageRange, monthName } from "@/lib/format";
import {
  isBirthdayInPeriod,
  type BirthdayPeriod,
} from "@/lib/birthday";
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
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SendButtons } from "@/components/modules/aniversariantes/send-buttons";
import { ConfigForm } from "@/components/modules/aniversariantes/config-form";

export const dynamic = "force-dynamic";

const selectCls =
  "h-9 rounded-md border bg-background px-3 text-sm outline-none";

function ddmm(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(
    d.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}

export default async function AniversariantesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date();
  const period = (
    ["dia", "semana", "mes"].includes(sp.period ?? "")
      ? sp.period
      : "mes"
  ) as BirthdayPeriod;
  const month = Math.min(
    12,
    Math.max(1, Number(sp.month ?? today.getMonth() + 1) || today.getMonth() + 1),
  );

  const [members, cfg, logs] = await Promise.all([
    prisma.member.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        fullName: true,
        phone: true,
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

  const list = members
    .filter((m) =>
      isBirthdayInPeriod(new Date(m.birthDate), period, month, today),
    )
    .sort((a, b) => {
      const da = new Date(a.birthDate);
      const db = new Date(b.birthDate);
      return (
        da.getUTCMonth() - db.getUTCMonth() ||
        da.getUTCDate() - db.getUTCDate()
      );
    });

  return (
    <div>
      <PageHeader
        title="Aniversariantes"
        description="Aniversariantes por dia, semana ou mês"
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <select name="period" defaultValue={period} className={selectCls}>
          <option value="dia">Hoje</option>
          <option value="semana">Próximos 7 dias</option>
          <option value="mes">Por mês</option>
        </select>
        <select name="month" defaultValue={String(month)} className={selectCls}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {monthName(m)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary" size="sm">
          Filtrar
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cake className="size-4" />
            {list.length} aniversariante(s)
            {period === "mes" ? ` em ${monthName(month)}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Foto</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Faixa etária
                </TableHead>
                <TableHead>Aniversário</TableHead>
                <TableHead className="hidden md:table-cell">Telefone</TableHead>
                <TableHead className="text-right">Enviar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nenhum aniversariante no período.
                  </TableCell>
                </TableRow>
              )}
              {list.map((m) => {
                const age = calculateAge(new Date(m.birthDate));
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Avatar className="size-9">
                        {m.photoUrl && (
                          <AvatarImage src={m.photoUrl} alt={m.fullName} />
                        )}
                        <AvatarFallback className="text-xs">
                          {m.fullName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{m.fullName}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">{ageRange(age)}</Badge>
                    </TableCell>
                    <TableCell>{ddmm(new Date(m.birthDate))}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {m.phone}
                    </TableCell>
                    <TableCell>
                      <SendButtons memberId={m.id} />
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

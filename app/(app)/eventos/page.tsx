import Link from "next/link";
import { CalendarPlus, MapPin, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import {
  ATIVIDADE_CATEGORY_CODES,
  EVENT_DIFFICULTY,
  EVENT_STATUS,
  EVENTO_CATEGORY_CODES,
  getSuperCategory,
  labelFrom,
} from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProjetarMuroButton } from "@/components/modules/eventos/projetar-muro-button";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive"> = {
  PLANEJADO: "secondary",
  CONFIRMADO: "default",
  REALIZADO: "secondary",
  CANCELADO: "destructive",
};

const SUPER_TABS = [
  { value: "todos", label: "Todos" },
  { value: "evento", label: "Eventos" },
  { value: "atividade", label: "Atividades" },
] as const;

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tipo?: string }>;
}) {
  const session = await auth();
  const sessionUser = toSessionUser(session!.user);
  const canCreate = await can(sessionUser, "eventos", "create");

  const sp = await searchParams;
  const status = sp.status ?? "ALL";
  const tipo = sp.tipo ?? "todos";

  const where: Record<string, unknown> = {};
  if (EVENT_STATUS.some((s) => s.value === status)) where.status = status;
  if (tipo === "evento") {
    where.categoryCode = { in: [...EVENTO_CATEGORY_CODES] };
  } else if (tipo === "atividade") {
    where.categoryCode = { in: [...ATIVIDADE_CATEGORY_CODES] };
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { dateTime: "desc" },
    include: {
      _count: { select: { registrations: true, attendees: true } },
      registrations: {
        where: { member: { deletedAt: null, status: "ACTIVE" } },
        include: { member: { select: { fullName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Eventos e Atividades"
        description={`${events.length} resultado(s)`}
      >
        {canCreate && (
          <>
            <ProjetarMuroButton />
            <Link
              href="/eventos/novo"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <CalendarPlus className="size-4" /> Novo
            </Link>
          </>
        )}
      </PageHeader>

      {/* Tabs de super-categoria */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex rounded-lg border bg-muted/30 p-1 gap-1">
          {SUPER_TABS.map((t) => (
            <Link
              key={t.value}
              href={`/eventos?tipo=${t.value}&status=${status}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tipo === t.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <form method="get" className="flex gap-2">
          <input type="hidden" name="tipo" value={tipo} />
          <select
            name="status"
            defaultValue={status}
            className="h-9 rounded-md border bg-background px-3 text-sm outline-none"
          >
            <option value="ALL">Todos os status</option>
            {EVENT_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="secondary" size="sm">
            Filtrar
          </Button>
        </form>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum evento cadastrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const superCat = getSuperCategory(e.categoryCode);
            return (
              <Link key={e.id} href={`/eventos/${e.id}`}>
                <Card className="h-full transition-colors hover:bg-accent/40">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{e.name}</CardTitle>
                      <Badge variant={STATUS_BADGE[e.status] ?? "secondary"}>
                        {labelFrom(EVENT_STATUS, e.status)}
                      </Badge>
                    </div>
                    {superCat && (
                      <Badge
                        variant="outline"
                        className="w-fit text-xs capitalize"
                      >
                        {superCat === "evento" ? "Evento" : "Atividade"}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      {formatDateTime(e.dateTime)}
                    </p>
                    {e.location && (
                      <p className="flex items-center gap-1">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate">{e.location}</span>
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      {superCat === "atividade" && e.difficulty && (
                        <Badge variant="secondary">
                          {labelFrom(EVENT_DIFFICULTY, e.difficulty)}
                        </Badge>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5" />
                          {e._count.registrations} inscritos
                        </span>
                        {e._count.attendees > 0 && (
                          <span className="flex items-center gap-1 text-primary">
                            {e._count.attendees} presentes
                          </span>
                        )}
                      </div>
                    </div>
                    {e.registrations.length > 0 && (
                      <ol className="mt-2 space-y-0.5 border-t pt-2">
                        {e.registrations.slice(0, 5).map((r, idx) => (
                          <li
                            key={idx}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground"
                          >
                            <span className="w-4 shrink-0 text-right font-medium tabular-nums text-foreground/60">
                              {idx + 1}º
                            </span>
                            <span className="truncate">{r.member.fullName}</span>
                          </li>
                        ))}
                        {e.registrations.length > 5 && (
                          <li className="pl-6 text-xs text-muted-foreground">
                            +{e.registrations.length - 5} mais…
                          </li>
                        )}
                      </ol>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

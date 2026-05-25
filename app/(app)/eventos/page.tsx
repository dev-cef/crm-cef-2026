import Link from "next/link";
import { CalendarPlus, MapPin, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { EVENT_DIFFICULTY, EVENT_STATUS, labelFrom } from "@/lib/constants";
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

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  const sessionUser = toSessionUser(session!.user);
  const canCreate = await can(sessionUser, "eventos", "create");

  const sp = await searchParams;
  const status = sp.status ?? "ALL";

  const where: Record<string, unknown> = {};
  if (EVENT_STATUS.some((s) => s.value === status)) where.status = status;

  const events = await prisma.event.findMany({
    where,
    orderBy: { dateTime: "desc" },
    include: {
      _count: { select: { registrations: true } },
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
        title="Eventos"
        description={`${events.length} evento(s)`}
      >
        {canCreate && (
          <>
            <ProjetarMuroButton />
            <Link
              href="/eventos/novo"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <CalendarPlus className="size-4" /> Novo evento
            </Link>
          </>
        )}
      </PageHeader>

      <form method="get" className="mb-4 flex gap-2">
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

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhum evento cadastrado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <Link key={e.id} href={`/eventos/${e.id}`}>
              <Card className="h-full transition-colors hover:bg-accent/40">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{e.name}</CardTitle>
                    <Badge variant={STATUS_BADGE[e.status] ?? "secondary"}>
                      {labelFrom(EVENT_STATUS, e.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    {formatDateTime(e.dateTime)}
                  </p>
                  <p className="flex items-center gap-1">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{e.location}</span>
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <Badge variant="secondary">
                      {labelFrom(EVENT_DIFFICULTY, e.difficulty)}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3.5" />
                      {e._count.registrations}
                      {e.slots > 0 ? `/${e.slots}` : ""} inscritos
                    </span>
                  </div>
                  {e.registrations.length > 0 && (
                    <ol className="mt-2 space-y-0.5 border-t pt-2">
                      {e.registrations.slice(0, 5).map((r, idx) => (
                        <li key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
          ))}
        </div>
      )}
    </div>
  );
}

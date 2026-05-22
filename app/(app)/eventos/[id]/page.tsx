import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, Pencil, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { EVENT_DIFFICULTY, EVENT_STATUS, labelFrom } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteEventDialog } from "@/components/modules/eventos/delete-event-dialog";
import { EventRegistrations } from "@/components/modules/eventos/event-registrations";
import { EventGallery } from "@/components/modules/eventos/event-gallery";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, "default" | "secondary" | "destructive"> = {
  PLANEJADO: "secondary",
  CONFIRMADO: "default",
  REALIZADO: "secondary",
  CANCELADO: "destructive",
};

export default async function EventoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  const sessionUser = toSessionUser(session!.user);
  const [canEdit, canDelete] = await Promise.all([
    can(sessionUser, "eventos", "edit"),
    can(sessionUser, "eventos", "delete"),
  ]);

  const ev = await prisma.event.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { createdAt: "desc" } },
      registrations: {
        where: { member: { deletedAt: null, status: "ACTIVE" } },
        include: { member: { select: { id: true, fullName: true } } },
        orderBy: { member: { fullName: "asc" } },
      },
    },
  });
  if (!ev) notFound();

  const registeredIds = new Set(ev.registrations.map((r) => r.memberId));
  const available = (
    await prisma.member.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    })
  ).filter((m) => !registeredIds.has(m.id));

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/eventos"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Eventos
      </Link>

      <PageHeader title={ev.name} description={ev.location}>
        {canEdit && (
          <Link
            href={`/eventos/${ev.id}/editar`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Pencil className="size-4" /> Editar
          </Link>
        )}
        {canDelete && <DeleteEventDialog id={ev.id} name={ev.name} />}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{ev.description}</p>
            <div className="flex flex-wrap gap-4 pt-2 text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-4" />
                {formatDateTime(ev.dateTime)}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-4" />
                {ev.location}
              </span>
              <span className="flex items-center gap-1">
                <Users className="size-4" />
                {ev.registrations.length}
                {ev.slots > 0 ? `/${ev.slots}` : ""} inscritos
              </span>
            </div>
            <div className="flex gap-2 pt-1">
              <Badge variant="secondary">
                {labelFrom(EVENT_DIFFICULTY, ev.difficulty)}
              </Badge>
              <Badge variant={STATUS_BADGE[ev.status] ?? "secondary"}>
                {labelFrom(EVENT_STATUS, ev.status)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vagas</span>
              <span>{ev.slots > 0 ? ev.slots : "Ilimitadas"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Inscritos</span>
              <span>{ev.registrations.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fotos</span>
              <span>{ev.photos.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Inscrições</CardTitle>
          </CardHeader>
          <CardContent>
            <EventRegistrations
              eventId={ev.id}
              registered={ev.registrations.map((r) => ({
                id: r.id,
                memberId: r.memberId,
                fullName: r.member.fullName,
              }))}
              available={available}
              selfMemberId={sessionUser.memberId ?? null}
              eventStatus={ev.status}
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Galeria de fotos</CardTitle>
          </CardHeader>
          <CardContent>
            <EventGallery
              eventId={ev.id}
              photos={ev.photos.map((p) => ({ id: p.id, url: p.url }))}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Mic,
  Pencil,
  Timer,
  UserCheck,
  Users,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import {
  EVENT_DIFFICULTY,
  EVENT_STATUS,
  getEventCategory,
  labelFrom,
} from "@/lib/constants";
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
        orderBy: { createdAt: "asc" },
      },
      attendees: {
        include: { member: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: "asc" },
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

  const cat = getEventCategory(ev.categoryCode);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/eventos"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Eventos e Atividades
      </Link>

      <PageHeader title={ev.name} description={cat?.label ?? ev.location}>
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
        {/* Detalhes principais */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {ev.description && <p>{ev.description}</p>}

            {/* Campo específico: Palestrante */}
            {ev.speakerName && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mic className="size-4 shrink-0" />
                <span>
                  <strong className="text-foreground">Palestrante:</strong>{" "}
                  {ev.speakerName}
                </span>
              </div>
            )}

            {/* Campo específico: Duração do filme */}
            {ev.filmDuration && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Timer className="size-4 shrink-0" />
                <span>
                  <strong className="text-foreground">Duração:</strong>{" "}
                  {ev.filmDuration}
                </span>
              </div>
            )}

            <div className="flex flex-wrap gap-4 pt-2 text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-4" />
                {formatDateTime(ev.dateTime)}
              </span>
              {ev.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-4" />
                  {ev.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="size-4" />
                {ev.registrations.length}
                {ev.slots > 0 ? `/${ev.slots}` : ""} inscritos
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {ev.difficulty && (
                <Badge variant="secondary">
                  {labelFrom(EVENT_DIFFICULTY, ev.difficulty)}
                </Badge>
              )}
              <Badge variant={STATUS_BADGE[ev.status] ?? "secondary"}>
                {labelFrom(EVENT_STATUS, ev.status)}
              </Badge>
              {cat && <Badge variant="outline">{cat.label}</Badge>}
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
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
              <span className="text-muted-foreground">Público que foi</span>
              <span className="font-medium text-primary">
                {ev.attendees.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fotos</span>
              <span>{ev.photos.length}</span>
            </div>
          </CardContent>
        </Card>

        {/* Público que foi */}
        {ev.attendees.length > 0 && (
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="size-4" />
                Público que foi
                <Badge variant="secondary">{ev.attendees.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="divide-y rounded-md border">
                {ev.attendees.map((a, idx) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                  >
                    <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span>{a.member.fullName}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">
                Para editar, use o botão{" "}
                <strong>Editar</strong> no cabeçalho.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Inscrições */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Inscrições</CardTitle>
          </CardHeader>
          <CardContent>
            <EventRegistrations
              eventId={ev.id}
              registered={ev.registrations.map((r, idx) => ({
                id: r.id,
                memberId: r.memberId,
                fullName: r.member.fullName,
                order: idx + 1,
              }))}
              available={available}
              selfMemberId={sessionUser.memberId ?? null}
              eventStatus={ev.status}
            />
          </CardContent>
        </Card>

        {/* Galeria */}
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

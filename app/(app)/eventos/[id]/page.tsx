import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  Mic,
  Mountain,
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
  ATIVIDADE_CATEGORY_CODES,
  EVENT_STATUS,
  FICHA_ESFORCO,
  FICHA_EXPOSICAO,
  FICHA_INSOLACAO,
  FICHA_TECNICA_CATEGORIES,
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
import { EventCaronaPanel, type CaronaOffer } from "@/components/modules/eventos/event-carona-panel";

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
      waitlist: {
        where: { member: { deletedAt: null, status: "ACTIVE" } },
        include: { member: { select: { id: true, fullName: true } } },
        orderBy: { position: "asc" },
      },
      caronas: {
        include: {
          driver: { select: { id: true, fullName: true, phone: true, whatsapp: true } },
          passengers: {
            include: { member: { select: { id: true, fullName: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ev) notFound();

  const registeredIds = new Set(ev.registrations.map((r) => r.memberId));
  const waitlistedIds = new Set(ev.waitlist.map((w) => w.memberId));
  const available = (
    await prisma.member.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    })
  ).filter((m) => !registeredIds.has(m.id) && !waitlistedIds.has(m.id));

  const cat = getEventCategory(ev.categoryCode);
  const isAtividade = (ATIVIDADE_CATEGORY_CODES as readonly string[]).includes(ev.categoryCode ?? "");
  const generalNames: string[] = (() => {
    try { return JSON.parse(ev.generalAttendeeNames); } catch { return []; }
  })();

  // Guias: parse do campo guideIds (multi-guia), com fallback para guideId legado
  const guideIdsList: string[] = (() => {
    try { const ids = JSON.parse(ev.guideIds); return ids.length > 0 ? ids : (ev.guideId ? [ev.guideId] : []); } catch { return ev.guideId ? [ev.guideId] : []; }
  })();
  const eventGuides = guideIdsList.length > 0
    ? await prisma.member.findMany({ where: { id: { in: guideIdsList } }, select: { id: true, fullName: true } })
    : [];
  const fichaOQueLevar: string[] = (() => {
    try { return JSON.parse(ev.fichaOQueLevar); } catch { return []; }
  })();
  const totalPublico = ev.attendees.length + generalNames.length;
  const hasFicha =
    (FICHA_TECNICA_CATEGORIES as readonly string[]).includes(ev.categoryCode ?? "") &&
    (ev.fichaDistanciaKm != null ||
      ev.fichaTempo ||
      ev.fichaEsforco ||
      ev.fichaInsolacao ||
      ev.fichaDesnivelPos != null ||
      ev.fichaElevacaoMax != null ||
      ev.fichaExposicao ||
      ev.fichaSaidaHorario ||
      ev.fichaSaidaLocal ||
      ev.fichaCarona ||
      fichaOQueLevar.length > 0 ||
      ev.fichaObs ||
      ev.fichaAtencao);

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

            {/* Guias da atividade */}
            {eventGuides.length > 0 && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <Mountain className="mt-0.5 size-4 shrink-0" />
                <span>
                  <strong className="text-foreground">
                    {eventGuides.length === 1 ? "Guia:" : "Guias:"}
                  </strong>{" "}
                  {eventGuides.map((g) => g.fullName).join(" · ")}
                </span>
              </div>
            )}

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
            {ev.waitlist.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fila de espera</span>
                <span className="font-medium text-orange-600">{ev.waitlist.length}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Público que foi</span>
              <span className="font-medium text-primary">{totalPublico}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fotos</span>
              <span>{ev.photos.length}</span>
            </div>
          </CardContent>
        </Card>

        {/* Ficha Técnica (Caminhada) */}
        {hasFicha && (
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">👣 Ficha Técnica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {ev.fichaDistanciaKm != null && (
                <div className="flex items-center gap-2">
                  <span>👣</span>
                  <span><strong>Distância:</strong> {ev.fichaDistanciaKm.toLocaleString("pt-BR")} km</span>
                </div>
              )}
              {ev.fichaTempo && (
                <div className="flex items-center gap-2">
                  <span>🕢</span>
                  <span><strong>Tempo:</strong> {ev.fichaTempo}</span>
                </div>
              )}
              {ev.fichaEsforco && (
                <div className="flex items-center gap-2">
                  <span>🥵</span>
                  <span><strong>Esforço:</strong> {labelFrom(FICHA_ESFORCO, ev.fichaEsforco)}</span>
                </div>
              )}
              {ev.fichaInsolacao && (
                <div className="flex items-center gap-2">
                  <span>☀️</span>
                  <span><strong>Nível de Insolação:</strong> {labelFrom(FICHA_INSOLACAO, ev.fichaInsolacao)}</span>
                </div>
              )}
              {ev.fichaDesnivelPos != null && (
                <div className="flex items-center gap-2">
                  <span>⛰</span>
                  <span><strong>Desnível Positivo:</strong> {ev.fichaDesnivelPos} m</span>
                </div>
              )}
              {ev.fichaElevacaoMax != null && (
                <div className="flex items-center gap-2">
                  <span>⛰</span>
                  <span><strong>Elevação Máxima:</strong> {ev.fichaElevacaoMax} m</span>
                </div>
              )}
              {ev.fichaExposicao && (
                <div className="flex items-center gap-2">
                  <span>☠️</span>
                  <span><strong>Grau de Exposição:</strong> {labelFrom(FICHA_EXPOSICAO, ev.fichaExposicao)}</span>
                </div>
              )}
              {ev.fichaSaidaHorario && (
                <div className="flex items-center gap-2">
                  <span>🕢</span>
                  <span>
                    <strong>Saída às</strong> {ev.fichaSaidaHorario}
                    {ev.fichaSaidaLocal ? ` — ${ev.fichaSaidaLocal}` : ""}
                  </span>
                </div>
              )}
              {ev.fichaCarona && (
                <div className="flex items-center gap-2">
                  <span>🚖</span>
                  <span><strong>Carona Colaborativa</strong></span>
                </div>
              )}
              {fichaOQueLevar.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="shrink-0">✅</span>
                  <div>
                    <strong>O que levar:</strong>{" "}
                    <span className="text-muted-foreground">{fichaOQueLevar.join(", ")}</span>
                  </div>
                </div>
              )}
              {ev.fichaObs && (
                <p className="border-t pt-2 text-muted-foreground">
                  <strong className="text-foreground">OBS.:</strong> {ev.fichaObs}
                </p>
              )}
              {ev.fichaAtencao && (
                <p className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-yellow-900 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
                  <strong>ATENÇÃO:</strong> {ev.fichaAtencao}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Público que foi */}
        {totalPublico > 0 && (
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="size-4" />
                Público que foi
                <Badge variant="secondary">{totalPublico}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Associados */}
              {ev.attendees.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Associados ({ev.attendees.length})
                  </p>
                  <ol className="divide-y rounded-md border">
                    {ev.attendees.map((a, idx) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                          {idx + 1}
                        </span>
                        <UserCheck className="size-3.5 shrink-0 text-primary" />
                        <span>{a.member.fullName}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Público em geral */}
              {generalNames.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Público em geral ({generalNames.length})
                  </p>
                  <ol className="divide-y rounded-md border">
                    {generalNames.map((name, idx) => (
                      <li
                        key={idx}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                          {idx + 1}
                        </span>
                        <span className="text-muted-foreground">◦</span>
                        <span>{name}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Para editar, use o botão <strong>Editar</strong> no cabeçalho.
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
              slots={ev.slots}
              registered={ev.registrations.map((r, idx) => ({
                id: r.id,
                memberId: r.memberId,
                fullName: r.member.fullName,
                order: idx + 1,
              }))}
              waitlist={ev.waitlist.map((w, idx) => ({
                id: w.id,
                memberId: w.memberId,
                fullName: w.member.fullName,
                position: idx + 1,
              }))}
              available={available}
              selfMemberId={sessionUser.memberId ?? null}
              eventStatus={ev.status}
            />
          </CardContent>
        </Card>

        {/* Carona colaborativa */}
        {isAtividade && (
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                🚗 Carona colaborativa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EventCaronaPanel
                eventId={ev.id}
                offers={ev.caronas.map((c): CaronaOffer => ({
                  id: c.id,
                  driverId: c.driverId,
                  driverName: c.driver.fullName,
                  driverPhone: c.driver.phone,
                  driverWhatsapp: c.driver.whatsapp,
                  seats: c.seats,
                  note: c.note,
                  passengers: c.passengers.map((p) => ({
                    id: p.id,
                    memberId: p.memberId,
                    memberName: p.member.fullName,
                  })),
                }))}
                selfMemberId={sessionUser.memberId ?? null}
                isRegistered={ev.registrations.some((r) => r.memberId === sessionUser.memberId)}
                eventStatus={ev.status}
              />
            </CardContent>
          </Card>
        )}

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

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { toDatetimeLocal } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EventForm } from "@/components/modules/eventos/event-form";

export const dynamic = "force-dynamic";

export default async function EditarEventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = toSessionUser(session.user);
  if (!(await can(user, "eventos", "edit"))) redirect(`/eventos/${id}`);

  const [ev, guides, members] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      include: { attendees: { select: { memberId: true } } },
    }),
    prisma.member.findMany({
      where: { isGuide: true, deletedAt: null, status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.member.findMany({
      where: { deletedAt: null, status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);
  if (!ev) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/eventos/${ev.id}`}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <PageHeader title="Editar" description={ev.name} />
      <EventForm
        mode="edit"
        event={{
          id: ev.id,
          name: ev.name,
          description: ev.description,
          dateTime: toDatetimeLocal(ev.dateTime),
          location: ev.location,
          slots: ev.slots,
          status: ev.status,
          categoryCode: ev.categoryCode,
          guideId: ev.guideId,
          guideIds: (() => { try { const ids = JSON.parse(ev.guideIds); return ids.length > 0 ? ids : (ev.guideId ? [ev.guideId] : []); } catch { return ev.guideId ? [ev.guideId] : []; } })(),
          speakerName: ev.speakerName,
          filmDuration: ev.filmDuration,
          attendeeIds: ev.attendees.map((a) => a.memberId),
          generalAttendeeNames: (() => {
            try { return JSON.parse(ev.generalAttendeeNames); } catch { return []; }
          })(),
          fichaDistanciaKm:  ev.fichaDistanciaKm,
          fichaTempo:        ev.fichaTempo,
          fichaEsforco:      ev.fichaEsforco,
          fichaInsolacao:    ev.fichaInsolacao,
          fichaDesnivelPos:  ev.fichaDesnivelPos,
          fichaElevacaoMax:  ev.fichaElevacaoMax,
          fichaExposicao:    ev.fichaExposicao,
          fichaSaidaHorario: ev.fichaSaidaHorario,
          fichaSaidaLocal:   ev.fichaSaidaLocal,
          fichaCarona:       ev.fichaCarona,
          fichaOQueLevar:    (() => { try { return JSON.parse(ev.fichaOQueLevar); } catch { return []; } })(),
          fichaObs:          ev.fichaObs,
          fichaAtencao:      ev.fichaAtencao,
        }}
        guides={guides.map((g) => ({ id: g.id, name: g.fullName }))}
        members={members}
      />
    </div>
  );
}

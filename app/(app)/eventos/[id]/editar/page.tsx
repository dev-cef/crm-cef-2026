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

  const ev = await prisma.event.findUnique({ where: { id } });
  if (!ev) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/eventos/${ev.id}`}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <PageHeader title="Editar evento" description={ev.name} />
      <EventForm
        mode="edit"
        event={{
          id: ev.id,
          name: ev.name,
          description: ev.description,
          dateTime: toDatetimeLocal(ev.dateTime),
          location: ev.location,
          difficulty: ev.difficulty,
          slots: ev.slots,
          status: ev.status,
        }}
      />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EventForm } from "@/components/modules/eventos/event-form";

export default async function NovoEventoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = toSessionUser(session.user);
  if (!(await can(user, "eventos", "create"))) redirect("/eventos");

  const [guides, members] = await Promise.all([
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

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/eventos"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Eventos e Atividades
      </Link>
      <PageHeader title="Novo evento / atividade" description="Selecione o tipo e preencha os dados" />
      <EventForm
        mode="create"
        guides={guides.map((g) => ({ id: g.id, name: g.fullName }))}
        members={members}
      />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EventForm } from "@/components/modules/eventos/event-form";

export default async function NovoEventoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = toSessionUser(session.user);
  if (!(await can(user, "eventos", "create"))) redirect("/eventos");

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/eventos"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Eventos
      </Link>
      <PageHeader title="Novo evento" description="Cadastre uma atividade" />
      <EventForm mode="create" />
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EventForm } from "@/components/modules/eventos/event-form";

export default function NovoEventoPage() {
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

"use client";

import { useTransition } from "react";
import { BookMarked, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reservarLivro, cancelarReserva } from "@/app/(app)/meu-espaco/biblioteca/actions";

export function ReservarButton({ livroId }: { livroId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const res = await reservarLivro(livroId);
      if (res.ok) toast.success("Livro reservado! A secretaria foi avisada — retire na sede.");
      else toast.error(res.error ?? "Erro ao reservar.");
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={handleClick}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <BookMarked className="size-3.5" />}
      Reservar
    </Button>
  );
}

export function CancelarReservaButton({ reservaId }: { reservaId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const res = await cancelarReserva(reservaId);
      if (res.ok) toast.success("Reserva cancelada.");
      else toast.error(res.error ?? "Erro ao cancelar.");
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={handleClick}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
      Cancelar
    </Button>
  );
}

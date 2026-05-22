"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Loader2, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  addRegistration,
  removeRegistration,
} from "@/app/(app)/eventos/actions";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";

export function EventRegistrations({
  eventId,
  registered,
  available,
  selfMemberId,
  eventStatus,
}: {
  eventId: string;
  registered: { id: string; memberId: string; fullName: string }[];
  available: { id: string; fullName: string }[];
  selfMemberId?: string | null;
  eventStatus?: string;
}) {
  const { can } = usePermissions();
  const canEdit = can("eventos", "edit");
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();

  const selfReg = selfMemberId
    ? registered.find((r) => r.memberId === selfMemberId) ?? null
    : null;
  const canSelfRegister =
    !!selfMemberId &&
    !selfReg &&
    eventStatus !== "REALIZADO" &&
    eventStatus !== "CANCELADO";

  function add() {
    if (!selected) return;
    startTransition(async () => {
      const res = await addRegistration(eventId, selected);
      if (res.ok) {
        toast.success("Associado inscrito.");
        setSelected("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro.");
      }
    });
  }

  function selfAdd() {
    if (!selfMemberId) return;
    startTransition(async () => {
      const res = await addRegistration(eventId, selfMemberId);
      if (res.ok) {
        toast.success("Inscrição realizada com sucesso!");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao se inscrever.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await removeRegistration(id, eventId);
      if (res.ok) {
        toast.success("Inscrição removida.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Botão de auto-inscrição para ASSOCIADO */}
      {selfMemberId && (
        <div className="flex items-center gap-3 rounded-lg border p-3">
          {selfReg ? (
            <>
              <span className="flex-1 text-sm text-muted-foreground">
                Você está inscrito neste evento.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => remove(selfReg.id)}
                disabled={pending || eventStatus === "REALIZADO" || eventStatus === "CANCELADO"}
                className="text-destructive hover:text-destructive"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                Cancelar inscrição
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-muted-foreground">
                {eventStatus === "CANCELADO"
                  ? "Este evento foi cancelado."
                  : eventStatus === "REALIZADO"
                    ? "Este evento já foi realizado."
                    : "Você não está inscrito neste evento."}
              </span>
              {canSelfRegister && (
                <Button size="sm" onClick={selfAdd} disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                  Me inscrever
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Painel admin: inscrever qualquer associado */}
      {canEdit && (
        <div className="flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-9 flex-1 rounded-md border bg-background px-3 text-sm outline-none"
          >
            <option value="">Selecione um associado…</option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={add} disabled={pending || !selected}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Inscrever
          </Button>
        </div>
      )}

      {registered.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Nenhum associado inscrito.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {registered.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{r.fullName}</span>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(r.id)}
                  disabled={pending}
                  aria-label="Remover inscrição"
                >
                  <X className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

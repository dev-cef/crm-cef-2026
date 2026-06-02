"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, LogIn, LogOut, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  addRegistration,
  removeRegistration,
  removeWaitlist,
} from "@/app/(app)/eventos/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/hooks/usePermissions";

export function EventRegistrations({
  eventId,
  slots,
  registered,
  waitlist,
  available,
  selfMemberId,
  eventStatus,
}: {
  eventId: string;
  slots: number;
  registered: { id: string; memberId: string; fullName: string; order?: number }[];
  waitlist: { id: string; memberId: string; fullName: string; position: number }[];
  available: { id: string; fullName: string }[];
  selfMemberId?: string | null;
  eventStatus?: string;
}) {
  const { can } = usePermissions();
  const canEdit = can("eventos", "edit");
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();

  const isClosed = eventStatus === "REALIZADO" || eventStatus === "CANCELADO";
  const isFull = slots > 0 && registered.length >= slots;

  const selfReg = selfMemberId
    ? registered.find((r) => r.memberId === selfMemberId) ?? null
    : null;
  const selfWait = selfMemberId
    ? waitlist.find((w) => w.memberId === selfMemberId) ?? null
    : null;
  const canSelfAct = !!selfMemberId && !selfReg && !selfWait && !isClosed;

  function add() {
    if (!selected) return;
    startTransition(async () => {
      const res = await addRegistration(eventId, selected);
      if (res.ok) {
        if (res.waitlisted) {
          toast.info(`Associado adicionado à fila de espera (posição ${res.position}).`);
        } else {
          toast.success("Associado inscrito.");
        }
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
        if (res.waitlisted) {
          toast.info(`Você entrou na fila de espera! Sua posição: ${res.position}º.`);
        } else {
          toast.success("Inscrição realizada com sucesso!");
        }
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

  function removeFromWaitlist(id: string) {
    startTransition(async () => {
      const res = await removeWaitlist(id, eventId);
      if (res.ok) {
        toast.success("Removido da fila de espera.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Self-registration panel */}
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
                disabled={pending || isClosed}
                className="text-destructive hover:text-destructive"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                Cancelar inscrição
              </Button>
            </>
          ) : selfWait ? (
            <>
              <Clock className="size-4 shrink-0 text-orange-500" />
              <span className="flex-1 text-sm text-muted-foreground">
                Você está na fila de espera —{" "}
                <strong className="text-orange-600">{selfWait.position}ª posição</strong>.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => removeFromWaitlist(selfWait.id)}
                disabled={pending || isClosed}
                className="text-destructive hover:text-destructive"
              >
                {pending ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
                Sair da fila
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-muted-foreground">
                {eventStatus === "CANCELADO"
                  ? "Este evento foi cancelado."
                  : eventStatus === "REALIZADO"
                    ? "Este evento já foi realizado."
                    : isFull
                      ? "Vagas esgotadas. Você pode entrar na fila de espera."
                      : "Você não está inscrito neste evento."}
              </span>
              {canSelfAct && (
                <Button size="sm" onClick={selfAdd} disabled={pending} variant={isFull ? "outline" : "default"}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : isFull ? (
                    <Clock className="size-4" />
                  ) : (
                    <LogIn className="size-4" />
                  )}
                  {isFull ? "Entrar na fila" : "Me inscrever"}
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Admin: register any member */}
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
            {isFull ? "Fila" : "Inscrever"}
          </Button>
        </div>
      )}

      {/* Registered list */}
      {registered.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Nenhum associado inscrito.</p>
      ) : (
        <ol className="divide-y rounded-md border">
          {registered.map((r) => (
            <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                {r.order != null && (
                  <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                    {r.order}º
                  </span>
                )}
                <span>{r.fullName}</span>
              </div>
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
        </ol>
      )}

      {/* Waitlist */}
      {waitlist.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-orange-500" />
            <span className="text-sm font-medium">Fila de espera</span>
            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
              {waitlist.length}
            </Badge>
          </div>
          <ol className="divide-y rounded-md border border-orange-200 bg-orange-50/40 dark:border-orange-900 dark:bg-orange-950/20">
            {waitlist.map((w) => (
              <li key={w.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-orange-500">
                    {w.position}º
                  </span>
                  <span>{w.fullName}</span>
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeFromWaitlist(w.id)}
                    disabled={pending}
                    aria-label="Remover da fila de espera"
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Quando uma vaga abrir, o 1º da fila é promovido automaticamente.
          </p>
        </div>
      )}
    </div>
  );
}

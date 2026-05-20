"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Loader2 } from "lucide-react";
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
}: {
  eventId: string;
  registered: { id: string; memberId: string; fullName: string }[];
  available: { id: string; fullName: string }[];
}) {
  const { can } = usePermissions();
  const canEdit = can("eventos", "edit");
  const router = useRouter();
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();

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
          <Button
            size="sm"
            onClick={add}
            disabled={pending || !selected}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
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
            <li
              key={r.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
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

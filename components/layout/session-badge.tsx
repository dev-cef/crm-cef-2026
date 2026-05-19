"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// Badge informativo: tempo restante até logout por inatividade. A janela
// desliza a cada navegação/ação — então isto reflete o tempo ocioso.
export function SessionBadge({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!expiresAt) return null;

  const remaining = Math.max(0, expiresAt - now);
  const min = Math.floor(remaining / 60);
  const warn = remaining > 0 && remaining <= 5 * 60;
  const expired = remaining <= 0;

  const label = expired
    ? "Sessão expirada"
    : min >= 60
      ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`
      : `${min} min`;

  return (
    <span
      title={
        expired
          ? "Sessão encerrada por inatividade — recarregue para entrar de novo."
          : `Logout por inatividade em ${label} (renova ao usar o sistema)`
      }
      aria-live="polite"
      className={cn(
        "hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex",
        expired || warn
          ? "bg-destructive/10 text-destructive"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Clock className="size-3.5" />
      {expired ? "Expirada" : label}
    </span>
  );
}

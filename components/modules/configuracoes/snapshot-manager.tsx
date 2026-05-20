"use client";

import { useState, useTransition } from "react";
import { Camera, Trash2, RotateCcw, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createSnapshot,
  deleteSnapshot,
  restoreSnapshot,
} from "@/app/(app)/configuracoes/backup/snapshot-actions";

type Snapshot = {
  id: string;
  label: string;
  sizeBytes: number;
  createdAt: Date;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  variant,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  variant: "destructive" | "default";
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!pending) onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <p>{description}</p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={pending} className="gap-2">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SnapshotManager({ initialSnapshots }: { initialSnapshots: Snapshot[] }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>(initialSnapshots);
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<Snapshot | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<Snapshot | null>(null);
  const [restoreResult, setRestoreResult] = useState<Record<string, number> | null>(null);

  function handleCreate() {
    if (!label.trim()) { toast.error("Informe um nome para o snapshot"); return; }
    startTransition(async () => {
      const res = await createSnapshot(label.trim());
      if (res.ok) {
        toast.success(`Snapshot "${label.trim()}" criado`);
        setLabel("");
        // Recarrega a lista adicionando o novo snapshot temporariamente
        const newSnap: Snapshot = {
          id: Date.now().toString(),
          label: label.trim(),
          sizeBytes: 0,
          createdAt: new Date(),
        };
        setSnapshots((prev) => [newSnap, ...prev]);
        // Força refresh para pegar o ID real
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error(res.error ?? "Erro ao criar snapshot");
      }
    });
  }

  function handleDelete(snap: Snapshot) {
    startTransition(async () => {
      const res = await deleteSnapshot(snap.id);
      if (res.ok) {
        toast.success(`Snapshot "${snap.label}" excluído`);
        setSnapshots((prev) => prev.filter((s) => s.id !== snap.id));
      } else {
        toast.error(res.error ?? "Erro ao excluir snapshot");
      }
      setConfirmDelete(null);
    });
  }

  function handleRestore(snap: Snapshot) {
    startTransition(async () => {
      const res = await restoreSnapshot(snap.id);
      if (res.ok && res.counts) {
        setRestoreResult(res.counts);
        toast.success(`Snapshot "${snap.label}" restaurado`);
      } else {
        toast.error(res.error ?? "Erro ao restaurar snapshot");
        setConfirmRestore(null);
      }
    });
  }

  const COUNT_LABELS: Record<string, string> = {
    users: "Usuários", departments: "Departamentos", plans: "Planos",
    members: "Associados", payments: "Pagamentos", transactions: "Transações",
    events: "Eventos", eventRegistrations: "Inscrições",
  };

  return (
    <div className="space-y-4">
      {/* Criar snapshot */}
      <div className="flex gap-2">
        <Input
          placeholder="Nome do snapshot (ex: Antes da importação)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          disabled={pending}
          className="flex-1"
        />
        <Button onClick={handleCreate} disabled={pending || !label.trim()} className="gap-2 shrink-0">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
          {pending ? "Salvando…" : "Criar snapshot"}
        </Button>
      </div>

      {/* Lista de snapshots */}
      {snapshots.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum snapshot criado ainda.
        </p>
      ) : (
        <div className="rounded-lg border divide-y overflow-hidden">
          {snapshots.map((snap) => (
            <div key={snap.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{snap.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(snap.createdAt)}
                  {snap.sizeBytes > 0 && ` · ${formatBytes(snap.sizeBytes)}`}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Restaurar este snapshot"
                  onClick={() => { setConfirmRestore(snap); setRestoreResult(null); }}
                  disabled={pending}
                >
                  <RotateCcw className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Excluir snapshot"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDelete(snap)}
                  disabled={pending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal confirmar exclusão */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(v) => { if (!v) setConfirmDelete(null); }}
        title="Excluir snapshot"
        description={`O snapshot "${confirmDelete?.label}" será excluído permanentemente.`}
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        pending={pending}
      />

      {/* Modal confirmar restore */}
      <Dialog
        open={!!confirmRestore}
        onOpenChange={(v) => { if (!pending) { if (!v) { setConfirmRestore(null); setRestoreResult(null); } } }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {restoreResult ? "Restauração concluída" : "Restaurar snapshot"}
            </DialogTitle>
          </DialogHeader>

          {!restoreResult ? (
            <div className="space-y-4">
              <div className="flex gap-2 rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Os dados atuais serão sobrescritos.</p>
                  <p className="text-xs mt-0.5">
                    Snapshot: <strong>{confirmRestore?.label}</strong> — {confirmRestore && formatDate(confirmRestore.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmRestore(null)} disabled={pending}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => confirmRestore && handleRestore(confirmRestore)}
                  disabled={pending}
                  className="gap-2"
                >
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  {pending ? "Restaurando…" : "Confirmar restauração"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="size-5" />
                <p className="font-medium">Restauração concluída</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-1">
                {Object.entries(restoreResult).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{COUNT_LABELS[k] ?? k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { setConfirmRestore(null); setRestoreResult(null); }}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

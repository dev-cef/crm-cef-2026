"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { restoreBackup } from "@/app/(app)/configuracoes/backup/restore-action";

type BackupMeta = {
  generatedAt: string;
  version: string;
  counts: Record<string, number>;
};

type RestoredCounts = {
  users: number;
  departments: number;
  plans: number;
  members: number;
  payments: number;
  transactions: number;
  events: number;
  eventRegistrations: number;
};

const COUNT_LABELS: Record<string, string> = {
  users: "Usuários atualizados",
  departments: "Departamentos",
  plans: "Planos",
  members: "Associados",
  payments: "Pagamentos",
  transactions: "Transações",
  events: "Eventos",
  eventRegistrations: "Inscrições em eventos",
};

export function RestoreSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [parsed, setParsed] = useState<{ meta: BackupMeta; raw: Record<string, unknown> } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<RestoredCounts | null>(null);

  function handleFile(file: File) {
    if (!file.name.endsWith(".json")) {
      toast.error("Selecione um arquivo .json gerado pelo sistema de backup.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.meta || !json.data) throw new Error("Formato inválido");
        setParsed({ meta: json.meta as BackupMeta, raw: json });
        setConfirmOpen(true);
        setResult(null);
      } catch {
        toast.error("Arquivo inválido. Use apenas backups gerados por este sistema.");
      }
    };
    reader.readAsText(file);
  }

  function handleConfirm() {
    if (!parsed) return;
    startTransition(async () => {
      const res = await restoreBackup(parsed.raw as Record<string, unknown>);
      if (res.ok && res.counts) {
        setResult(res.counts);
        toast.success("Backup restaurado com sucesso");
      } else {
        toast.error(res.error ?? "Erro ao restaurar backup");
        setConfirmOpen(false);
      }
    });
  }

  const backupDate = parsed
    ? new Date(parsed.meta.generatedAt).toLocaleString("pt-BR")
    : null;

  return (
    <>
      <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
        <Upload className="mx-auto size-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Selecione o arquivo de backup</p>
          <p className="text-xs text-muted-foreground mt-1">
            Apenas arquivos <code>.json</code> gerados por este sistema
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
        >
          Escolher arquivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <Dialog open={confirmOpen} onOpenChange={(v) => { if (!pending) { setConfirmOpen(v); if (!v) setParsed(null); setResult(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {result ? "Restauração concluída" : "Confirmar restauração"}
            </DialogTitle>
          </DialogHeader>

          {!result ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 p-3 flex gap-2 text-amber-700 dark:text-amber-400 text-sm">
                <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">Atenção: operação irreversível</p>
                  <p className="text-xs">
                    Os dados existentes serão sobrescritos pelos dados do backup.
                    Novos usuários no backup são ignorados (sem senha para restaurar).
                  </p>
                </div>
              </div>

              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">
                  Backup gerado em: <strong className="text-foreground">{backupDate}</strong>
                </p>
                <p className="text-muted-foreground">
                  Versão: <strong className="text-foreground">{parsed?.meta.version}</strong>
                </p>
              </div>

              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="font-medium mb-2">Registros no backup:</p>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  {Object.entries(parsed?.meta.counts ?? {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="capitalize">{k}</span>
                      <span className="font-medium text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleConfirm} disabled={pending} className="gap-2">
                  {pending && <Loader2 className="size-4 animate-spin" />}
                  {pending ? "Restaurando…" : "Confirmar restauração"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle2 className="size-5" />
                <p className="font-medium">Dados restaurados com sucesso</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="font-medium mb-2">Registros restaurados:</p>
                <div className="space-y-1 text-xs">
                  {Object.entries(result).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-muted-foreground">{COUNT_LABELS[k] ?? k}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { setConfirmOpen(false); setParsed(null); setResult(null); }}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

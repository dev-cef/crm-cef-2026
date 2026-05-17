"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { markAsPaid } from "@/app/(app)/financeiro/actions";

type Props = {
  open: boolean;
  onClose: () => void;
  paymentId: string;
  memberName: string;
  amount: number;
  dueDate: string; // ISO string
};

const MAX_NOTES = 500;

export function DarBaixaDialog({
  open,
  onClose,
  paymentId,
  memberName,
  amount,
  dueDate,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const [paidDate, setPaidDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    if (pending) return;
    setPaidDate(today);
    setNotes("");
    setFile(null);
    onClose();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }
    setFile(f);
  }

  function handleConfirm() {
    startTransition(async () => {
      const parsedDate = new Date(paidDate + "T12:00:00");
      const res = await markAsPaid(paymentId, parsedDate, notes || undefined);
      if (res.ok) {
        toast.success("Pagamento baixado com sucesso.");
        handleClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao registrar pagamento.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar baixa de pagamento</DialogTitle>
          <DialogDescription>
            {memberName} — {formatBRL(amount)} (vencimento{" "}
            {formatDate(new Date(dueDate))})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Data do pagamento */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Data do pagamento
            </label>
            <Input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              max={today}
            />
          </div>

          {/* Observação */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Observação <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES))}
              placeholder="Ex.: pagamento via PIX, depósito conferido, etc."
              rows={4}
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50"
            />
            <p className="mt-0.5 text-right text-xs text-muted-foreground">
              {notes.length}/{MAX_NOTES}
            </p>
          </div>

          {/* Comprovante */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Comprovante / recibo{" "}
              <span className="text-muted-foreground">(opcional)</span>
            </label>
            {file ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="flex-1 truncate text-muted-foreground">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-1.5 rounded-md border-2 border-dashed px-4 py-5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <Upload className="size-5" />
                <span>Clique para enviar arquivo</span>
                <span className="text-xs">PDF, PNG ou JPG — até 5MB</span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={pending || !paidDate}>
            {pending ? "Salvando…" : "Confirmar baixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

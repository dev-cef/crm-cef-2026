"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { editPayment } from "@/app/(app)/financeiro/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const MONTHS = [
  { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" }, { value: 4, label: "Abril" },
  { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
  { value: 7, label: "Julho" }, { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" }, { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
];

const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

type Props = {
  id: string;
  memberName: string;
  amount: number;
  dueDate: string;       // ISO string
  referenceMonth: number;
  referenceYear: number;
  status: string;
  notes: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

function toInputDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function EditPaymentDialog({
  id, memberName, amount, dueDate, referenceMonth, referenceYear, status, notes,
  open, onOpenChange,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    amount,
    dueDate: toInputDate(dueDate),
    referenceMonth,
    referenceYear,
    status: status as "PAGO" | "PENDENTE" | "ATRASADO",
    notes: notes ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        amount,
        dueDate: toInputDate(dueDate),
        referenceMonth,
        referenceYear,
        status: status as "PAGO" | "PENDENTE" | "ATRASADO",
        notes: notes ?? "",
      });
    }
  }, [open, amount, dueDate, referenceMonth, referenceYear, status, notes]);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = await editPayment(id, form);
      if (res.ok) {
        toast.success("Pagamento atualizado.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao salvar.");
      }
    });
  }

  const canSave =
    form.amount > 0 &&
    /^\d{2}\/\d{2}\/\d{4}$/.test(form.dueDate) &&
    form.referenceMonth >= 1 &&
    form.referenceYear > 2000;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4" /> Editar pagamento
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{memberName}</p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Valor */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-amount">Valor (R$) <span className="text-destructive">*</span></Label>
            <Input
              id="ep-amount"
              type="number"
              min={0}
              step={0.01}
              value={form.amount > 0 ? String(form.amount) : ""}
              onChange={(e) => set("amount", parseFloat(e.target.value) || 0)}
            />
          </div>

          {/* Vencimento */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-due">Vencimento <span className="text-destructive">*</span></Label>
            <Input
              id="ep-due"
              placeholder="DD/MM/AAAA"
              maxLength={10}
              value={form.dueDate}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, "");
                if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                if (v.length > 5) v = `${v.slice(0, 5)}/${v.slice(5, 9)}`;
                set("dueDate", v);
              }}
            />
          </div>

          {/* Competência */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mês de competência</Label>
              <Select
                value={String(form.referenceMonth)}
                onValueChange={(v) => set("referenceMonth", Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ano de competência</Label>
              <Select
                value={String(form.referenceYear)}
                onValueChange={(v) => set("referenceYear", Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => set("status", v as "PAGO" | "PENDENTE" | "ATRASADO")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDENTE">Pendente</SelectItem>
                <SelectItem value="PAGO">Pago</SelectItem>
                <SelectItem value="ATRASADO">Atrasado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="ep-notes">Observações</Label>
            <Textarea
              id="ep-notes"
              rows={2}
              placeholder="Opcional…"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleSubmit} disabled={pending || !canSave}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

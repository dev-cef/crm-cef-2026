"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { saveEnrollmentFee } from "@/app/(app)/financeiro/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function EnrollmentFeeDialog({ current }: { current: number }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(current));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpen(v: boolean) {
    if (v) setValue(String(current));
    setOpen(v);
  }

  function handleSave() {
    const fee = parseFloat(value);
    if (isNaN(fee) || fee < 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    startTransition(async () => {
      const res = await saveEnrollmentFee(fee);
      if (res.ok) {
        toast.success("Taxa de inscrição atualizada.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao salvar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" /> Editar taxa
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Taxa de Inscrição</DialogTitle>
          <DialogDescription>
            Valor cobrado uma única vez de cada novo associado ao se filiar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <Label htmlFor="enrollment-fee">Valor (R$)</Label>
          <Input
            id="enrollment-fee"
            type="number"
            min={0}
            step={0.01}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            autoFocus
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

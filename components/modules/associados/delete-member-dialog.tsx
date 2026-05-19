"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { softDeleteMember } from "@/app/(app)/associados/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

function todayBr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function DeleteMemberDialog({
  id,
  name,
  trigger,
  redirectTo,
}: {
  id: string;
  name: string;
  trigger: React.ReactElement;
  redirectTo?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [exitDate, setExitDate] = useState(todayBr);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClose(v: boolean) {
    if (!v) {
      setReason("");
      setExitDate(todayBr());
    }
    setOpen(v);
  }

  const canSubmit = reason.trim() !== "" && exitDate.trim() !== "";

  function handleDelete() {
    if (!canSubmit) return;
    startTransition(async () => {
      const res = await softDeleteMember(id, reason.trim(), exitDate.trim());
      if (res.ok) {
        toast.success("Associado desativado e motivo registrado.");
        setOpen(false);
        setReason("");
        setExitDate(todayBr());
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desativar associado</DialogTitle>
          <DialogDescription>
            Você está desativando <strong>{name}</strong>. O registro não será
            apagado e poderá ser reativado posteriormente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="exit-date">
              Data de saída <span className="text-destructive">*</span>
            </Label>
            <Input
              id="exit-date"
              placeholder="DD/MM/AAAA"
              maxLength={10}
              value={exitDate}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, "");
                if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                if (v.length > 5) v = `${v.slice(0, 5)}/${v.slice(5, 9)}`;
                setExitDate(v);
              }}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inactive-reason">
              Motivo do desligamento <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="inactive-reason"
              placeholder="Descreva o motivo pelo qual o associado está saindo…"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Campos obrigatórios — somente administradores podem registrar desligamentos.
          </p>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancelar
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={pending || !canSubmit}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Salvar e desativar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

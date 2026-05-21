"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { rejectRequest } from "@/app/(app)/carteirinha/fisica/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

export function RejectDialog({
  requestId,
  trigger,
}: {
  requestId: string;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await rejectRequest(requestId, reason);
      if (res.ok) {
        toast.success("Solicitação reprovada.");
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao reprovar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Reprovar solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo da reprovação. Este campo é obrigatório.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Motivo *</Label>
            <Textarea
              id="reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Atividades não confirmadas pelo instrutor responsável."
              required
              minLength={5}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending || reason.length < 5}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
              Reprovar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

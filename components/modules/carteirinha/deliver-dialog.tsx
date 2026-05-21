"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { deliverCard } from "@/app/(app)/carteirinha/fisica/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function todayISO() {
  return new Date().toISOString().split("T")[0]!;
}

export function DeliverDialog({
  requestId,
  memberName,
  trigger,
}: {
  requestId: string;
  memberName: string;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [deliveredAt, setDeliveredAt] = useState(todayISO());
  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setDeliveredAt(todayISO());
      setReceivedBy("");
      setNotes("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await deliverCard(requestId, { deliveredAt, receivedBy, notes });
      if (res.ok) {
        toast.success("Entrega registrada!");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao registrar entrega.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar entrega da carteirinha</DialogTitle>
            <DialogDescription>Sócio: {memberName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div>
              <Label htmlFor="deliveredAt">Data da entrega *</Label>
              <Input
                id="deliveredAt"
                type="date"
                value={deliveredAt}
                onChange={(e) => setDeliveredAt(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="receivedBy">Quem retirou (opcional)</Label>
              <Input
                id="receivedBy"
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Próprio sócio"
              />
            </div>
            <div>
              <Label htmlFor="deliveryNotes">Observações</Label>
              <Textarea
                id="deliveryNotes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: Entregue ao cônjuge mediante autorização."
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
              Confirmar entrega
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { markAsIssued } from "@/app/(app)/carteirinha/fisica/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function BatchIssueDialog({
  requestIds,
  memberNames,
  trigger,
}: {
  requestIds: string[];
  memberNames: string[];
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [issuedAt, setIssuedAt] = useState(todayISO());
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await markAsIssued(requestIds, issuedAt);
      if (res.ok) {
        toast.success(`${res.count} carteirinha(s) marcada(s) como emitida(s).`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao marcar como emitida.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Marcar como emitidas</DialogTitle>
            <DialogDescription>
              {requestIds.length} carteirinha(s) selecionada(s) serão marcadas como em produção.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div>
              <Label htmlFor="issuedAt">Data de emissão *</Label>
              <Input
                id="issuedAt"
                type="date"
                value={issuedAt}
                onChange={(e) => setIssuedAt(e.target.value)}
                required
              />
            </div>
            {memberNames.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-md border bg-muted/40 p-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Sócios selecionados:</p>
                <ul className="space-y-0.5">
                  {memberNames.map((name, i) => (
                    <li key={i} className="text-xs">{name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
              Confirmar emissão
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

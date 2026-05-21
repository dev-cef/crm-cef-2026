"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateMemberSince } from "@/app/(app)/associados/actions";
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

type Props = { memberId: string; current: string };

function maskDate(v: string) {
  let d = v.replace(/\D/g, "");
  if (d.length > 2) d = `${d.slice(0, 2)}/${d.slice(2)}`;
  if (d.length > 5) d = `${d.slice(0, 5)}/${d.slice(5, 9)}`;
  return d;
}

export function MemberSinceDialog({ memberId, current }: Props) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(current);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const valid = /^\d{2}\/\d{2}\/\d{4}$/.test(date);

  function handleOpen(v: boolean) {
    if (v) setDate(current);
    setOpen(v);
  }

  function handleSave() {
    if (!valid) return;
    startTransition(async () => {
      const res = await updateMemberSince(memberId, date);
      if (res.ok) {
        toast.success("Data de inscrição atualizada.");
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
          <Button variant="ghost" size="icon-sm" className="ml-1 size-6 text-muted-foreground hover:text-foreground" aria-label="Alterar data de inscrição">
            <CalendarDays className="size-3.5" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Alterar data de inscrição</DialogTitle>
          <DialogDescription>
            Define quando o associado ingressou no clube.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          <Label htmlFor="member-since-date">Associado desde</Label>
          <Input
            id="member-since-date"
            placeholder="DD/MM/AAAA"
            maxLength={10}
            value={date}
            onChange={(e) => setDate(maskDate(e.target.value))}
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleSave} disabled={pending || !valid}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

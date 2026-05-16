"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { launchMonthly } from "@/app/(app)/financeiro/actions";
import { Button } from "@/components/ui/button";
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

export function LaunchMonthly({
  month,
  year,
  label,
}: {
  month: number;
  year: number;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await launchMonthly(month, year);
      if (res.ok) {
        toast.success(
          res.created > 0
            ? `${res.created} mensalidade(s) lançada(s).`
            : "Nenhuma nova mensalidade (já lançadas).",
        );
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao lançar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <PlayCircle className="size-4" /> Lançar mensalidade
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar mensalidade</DialogTitle>
          <DialogDescription>
            Gera a cobrança de <strong>{label}</strong> para todos os
            associados ativos com plano que ainda não possuem lançamento neste
            período.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button onClick={run} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlayCircle className="size-4" />
            )}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

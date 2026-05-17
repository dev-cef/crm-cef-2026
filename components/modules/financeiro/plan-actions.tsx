"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Power, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deletePlan, togglePlan } from "@/app/(app)/financeiro/actions";
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
import { PlanDialog } from "@/components/modules/financeiro/plan-dialog";

export function PlanActions({
  plan,
}: {
  plan: {
    id: string;
    name: string;
    monthlyPrice: number;
    billingPeriod: string;
    description: string | null;
    active: boolean;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [delOpen, setDelOpen] = useState(false);

  function toggle() {
    startTransition(async () => {
      const res = await togglePlan(plan.id);
      if (res.ok) {
        toast.success(plan.active ? "Plano desativado." : "Plano ativado.");
        router.refresh();
      } else toast.error(res.error ?? "Erro.");
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deletePlan(plan.id);
      if (res.ok) {
        toast.success("Plano excluído.");
        setDelOpen(false);
        router.refresh();
      } else toast.error(res.error ?? "Erro.");
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <PlanDialog
        plan={plan}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label="Editar">
            <Pencil className="size-4" />
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggle}
        disabled={pending}
        aria-label="Ativar/Desativar"
      >
        <Power className="size-4" />
      </Button>
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              aria-label="Excluir"
            />
          }
        >
          <Trash2 className="size-4" />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir plano</DialogTitle>
            <DialogDescription>
              Excluir <strong>{plan.name}</strong>? Esta ação não pode ser
              desfeita. Planos em uso por associados não podem ser excluídos
              (desative-os).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              onClick={remove}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

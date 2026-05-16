"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { planSchema, type PlanFormValues } from "@/lib/validations/finance";
import { savePlan } from "@/app/(app)/financeiro/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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

export function PlanDialog({
  trigger,
  plan,
}: {
  trigger: React.ReactElement;
  plan?: {
    id: string;
    name: string;
    monthlyPrice: number;
    description: string | null;
    active: boolean;
  };
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: plan?.name ?? "",
      monthlyPrice: plan?.monthlyPrice ?? 0,
      description: plan?.description ?? "",
      active: plan?.active ?? true,
    },
  });

  function onSubmit(values: PlanFormValues) {
    startTransition(async () => {
      const res = await savePlan(values, plan?.id);
      if (res.ok) {
        toast.success(plan ? "Plano atualizado!" : "Plano criado!");
        setOpen(false);
        if (!plan) reset();
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao salvar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{plan ? "Editar plano" : "Novo plano"}</DialogTitle>
            <DialogDescription>
              Defina nome, valor mensal e descrição.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" {...register("name")} />
              {errors.name && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="monthlyPrice">Valor mensal (R$) *</Label>
              <Input
                id="monthlyPrice"
                type="number"
                step="0.01"
                min="0"
                {...register("monthlyPrice")}
              />
              {errors.monthlyPrice && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.monthlyPrice.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="description">Descrição / benefícios</Label>
              <Textarea id="description" rows={3} {...register("description")} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={watch("active")}
                onCheckedChange={(v) => setValue("active", Boolean(v))}
              />
              Plano ativo
            </label>
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

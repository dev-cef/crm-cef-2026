"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { registrarDevolucao } from "@/app/(app)/biblioteca/actions";
import type { DevolucaoFormValues } from "@/app/(app)/biblioteca/actions";
import { differenceInDays } from "date-fns";

const schema = z.object({
  emprestimoId: z.string(),
  devolvidoEm: z.string(),
  estadoDevolucao: z.enum(["otimo", "bom", "regular", "danificado", "perdido"]),
  status: z.enum(["devolvido", "extraviado"]),
  observacoes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  emprestimoId: string;
  livroTitulo: string;
  socioNome: string;
  prazoDevolucao: Date;
  estadoRetirada: string;
}

export function DevolucaoDialog({ emprestimoId, livroTitulo, socioNome, prazoDevolucao, estadoRetirada }: Props) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const diasAtraso = differenceInDays(new Date(), prazoDevolucao);

  const { register, handleSubmit, setValue, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: { emprestimoId, devolvidoEm: today, estadoDevolucao: estadoRetirada as FormValues["estadoDevolucao"], status: "devolvido" },
  });

  async function onValid(values: FormValues) {
    const result = await registrarDevolucao(values as DevolucaoFormValues);
    if (result.ok) {
      toast.success("Devolução registrada!");
      setOpen(false);
    } else {
      toast.error(result.error ?? "Erro ao registrar devolução.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <RotateCcw className="size-4 mr-1" /> Devolver
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogTitle>Registrar devolução</DialogTitle>
        <DialogDescription>
          <strong>{livroTitulo}</strong> — {socioNome}
        </DialogDescription>

        {diasAtraso > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm text-amber-800">
            ⚠️ {diasAtraso} dia{diasAtraso !== 1 ? "s" : ""} de atraso (informativo — sem cobrança)
          </div>
        )}

        <form onSubmit={handleSubmit(onValid)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="devolvidoEm">Data de devolução</Label>
            <Input id="devolvidoEm" type="date" {...register("devolvidoEm")} />
          </div>
          <div className="space-y-1">
            <Label>Estado na devolução</Label>
            <Select
              defaultValue={estadoRetirada}
              onValueChange={(v) => setValue("estadoDevolucao", String(v) as FormValues["estadoDevolucao"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="otimo">Ótimo</SelectItem>
                <SelectItem value="bom">Bom</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="danificado">Danificado</SelectItem>
                <SelectItem value="perdido">Perdido/Extraviado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select defaultValue="devolvido" onValueChange={(v) => setValue("status", String(v) as FormValues["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="devolvido">Devolvido</SelectItem>
                <SelectItem value="extraviado">Extraviado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="obs">Observações</Label>
            <Textarea id="obs" rows={2} {...register("observacoes")} />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Registrando..." : "Confirmar devolução"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

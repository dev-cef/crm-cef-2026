"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registrarMovimentacao, type MovimentacaoFormValues } from "@/app/(app)/patrimonio/actions";
import { MOVIMENTACAO_LABELS } from "@/lib/patrimonio/types";
import type { PatrimonioLocal } from "@/lib/patrimonio/types";

type Member = { id: string; fullName: string };

type Props = {
  bemId: string;
  locais: PatrimonioLocal[];
  membros: Member[];
};

const TIPOS = Object.entries(MOVIMENTACAO_LABELS).filter(([k]) => k !== "entrada") as [string, string][];

export function MovimentacaoForm({ bemId, locais, membros }: Props) {
  const router = useRouter();
  const form = useForm<MovimentacaoFormValues>({
    defaultValues: { bemId, data: new Date().toISOString().split("T")[0] },
  });
  const { register, handleSubmit, setValue, control, formState: { isSubmitting } } = form;
  const tipo = useWatch({ control, name: "tipo" }) as string | undefined;

  async function submit(values: MovimentacaoFormValues) {
    const res = await registrarMovimentacao(values);
    if (!res.ok) { toast.error(res.error ?? "Erro."); return; }
    toast.success("Movimentação registrada.");
    router.push(`/patrimonio/${bemId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      <div className="space-y-1">
        <Label>Tipo de movimentação *</Label>
        <Select onValueChange={(v) => setValue("tipo", String(v) as MovimentacaoFormValues["tipo"])}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {TIPOS.map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="data">Data *</Label>
        <Input id="data" type="date" {...register("data")} />
      </div>

      {(tipo === "transferencia" || tipo === "emprestimo") && (
        <div className="space-y-1">
          <Label>Local de origem</Label>
          <Select onValueChange={(v) => setValue("localOrigemId", String(v) === "_none" ? "" : String(v))}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— Nenhum —</SelectItem>
              {locais.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {(tipo === "transferencia" || tipo === "emprestimo") && (
        <div className="space-y-1">
          <Label>Local de destino {tipo === "transferencia" ? "*" : ""}</Label>
          <Select onValueChange={(v) => setValue("localDestinoId", String(v) === "_none" ? "" : String(v))}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— Nenhum —</SelectItem>
              {locais.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <Label>Responsável {tipo === "emprestimo" ? "*" : ""}</Label>
        <Select onValueChange={(v) => setValue("responsavelId", String(v) === "_none" ? "" : String(v))}>
          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">— Nenhum —</SelectItem>
            {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {tipo === "emprestimo" && (
        <div className="space-y-1">
          <Label htmlFor="dataDevolucaoPrevista">Data prevista de devolução *</Label>
          <Input id="dataDevolucaoPrevista" type="date" {...register("dataDevolucaoPrevista")} />
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" {...register("observacoes")} rows={3} />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Registrando..." : "Registrar movimentação"}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import type { BemFormValues } from "@/app/(app)/patrimonio/actions";
import type { PatrimonioLocal } from "@/lib/patrimonio/types";

type Member = { id: string; fullName: string; email: string };

type Props = {
  defaultValues?: Partial<BemFormValues>;
  locais: PatrimonioLocal[];
  membros: Member[];
  onSubmit: (values: BemFormValues) => Promise<{ ok: boolean; error?: string; id?: string }>;
  submitLabel?: string;
};

export function BemForm({ defaultValues, locais, membros, onSubmit, submitLabel = "Salvar" }: Props) {
  const router = useRouter();
  const form = useForm<BemFormValues>({ defaultValues });
  const { register, handleSubmit, setValue, watch, formState: { isSubmitting } } = form;

  async function submit(values: BemFormValues) {
    const res = await onSubmit(values);
    if (!res.ok) {
      toast.error(res.error ?? "Erro ao salvar.");
      return;
    }
    toast.success("Bem salvo com sucesso.");
    if (res.id) router.push(`/patrimonio/${res.id}`);
    else router.push("/patrimonio");
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6">
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Identificação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" {...register("nome")} placeholder="Ex: Corda semiestática 50m" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="categoria">Categoria *</Label>
            <Select
              defaultValue={defaultValues?.categoria}
              onValueChange={(v) => setValue("categoria", String(v) as BemFormValues["categoria"])}
            >
              <SelectTrigger id="categoria">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equipamento">Equipamento</SelectItem>
                <SelectItem value="movel_utensilio">Móvel / Utensílio</SelectItem>
                <SelectItem value="eletronico">Eletrônico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="estado">Estado de conservação</Label>
            <Select
              defaultValue={defaultValues?.estado ?? "bom"}
              onValueChange={(v) => setValue("estado", String(v) as BemFormValues["estado"])}
            >
              <SelectTrigger id="estado">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="otimo">Ótimo</SelectItem>
                <SelectItem value="bom">Bom</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="danificado">Danificado</SelectItem>
                <SelectItem value="descartado">Descartado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="marca">Marca</Label>
            <Input id="marca" {...register("marca")} placeholder="Ex: Petzl" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="modelo">Modelo</Label>
            <Input id="modelo" {...register("modelo")} placeholder="Ex: Arial" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="numeroSerie">Número de série</Label>
            <Input id="numeroSerie" {...register("numeroSerie")} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" {...register("descricao")} rows={2} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Localização e responsável</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Local atual</Label>
            <Select
              defaultValue={defaultValues?.localId ?? ""}
              onValueChange={(v) => setValue("localId", String(v) === "_none" ? "" : String(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o local" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Nenhum —</SelectItem>
                {locais.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Responsável</Label>
            <Select
              defaultValue={defaultValues?.responsavelId ?? ""}
              onValueChange={(v) => setValue("responsavelId", String(v) === "_none" ? "" : String(v))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Nenhum —</SelectItem>
                {membros.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Aquisição</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="valorAquisicao">Valor de aquisição (R$)</Label>
            <Input id="valorAquisicao" type="number" step="0.01" min="0" {...register("valorAquisicao")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dataAquisicao">Data de aquisição</Label>
            <Input id="dataAquisicao" type="date" {...register("dataAquisicao")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notaFiscal">Nota fiscal</Label>
            <Input id="notaFiscal" {...register("notaFiscal")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fornecedor">Fornecedor</Label>
            <Input id="fornecedor" {...register("fornecedor")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="vidaUtilAnos">Vida útil (anos)</Label>
            <Input id="vidaUtilAnos" type="number" min="0" {...register("vidaUtilAnos")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="valorResidual">Valor residual (R$)</Label>
            <Input id="valorResidual" type="number" step="0.01" min="0" {...register("valorResidual")} />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Observações</h2>
        <Textarea {...register("observacoes")} rows={3} placeholder="Observações adicionais..." />
      </section>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

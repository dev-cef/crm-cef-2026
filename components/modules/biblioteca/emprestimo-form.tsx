"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { EmprestimoFormValues } from "@/app/(app)/biblioteca/actions";
import type { Member } from "@/app/generated/prisma/client";

const schema = z.object({
  livroId: z.string().min(1, "Livro obrigatório"),
  socioId: z.string().min(1, "Sócio obrigatório"),
  retiradoEm: z.string(),
  prazoDevolucao: z.string(),
  estadoRetirada: z.enum(["otimo", "bom", "regular", "danificado", "perdido"]),
  observacoes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Livro { id: string; titulo: string; autor: string | null; numeroTombo: string | null; disponivel: boolean; }

interface Props {
  livros: Livro[];
  membros: Pick<Member, "id" | "fullName">[];
  onSubmit: (v: EmprestimoFormValues) => Promise<{ ok: boolean; error?: string }>;
  defaultLivroId?: string;
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r.toISOString().split("T")[0];
}

export function EmprestimoForm({ livros, membros, onSubmit, defaultLivroId }: Props) {
  const today = new Date().toISOString().split("T")[0];

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      livroId: defaultLivroId ?? "",
      retiradoEm: today,
      prazoDevolucao: addDays(new Date(), 30),
      estadoRetirada: "otimo",
    },
  });

  async function onValid(values: FormValues) {
    const result = await onSubmit(values as EmprestimoFormValues);
    if (result.ok) toast.success("Empréstimo registrado!");
    else toast.error(result.error ?? "Erro ao registrar empréstimo.");
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-5">
      <div className="space-y-1">
        <Label>Livro *</Label>
        <Select
          defaultValue={defaultLivroId ?? ""}
          onValueChange={(v) => setValue("livroId", String(v))}
        >
          <SelectTrigger><SelectValue placeholder="Selecione o livro" /></SelectTrigger>
          <SelectContent>
            {livros.filter((l) => l.disponivel).map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.titulo}{l.autor ? ` — ${l.autor}` : ""}{l.numeroTombo ? ` (${l.numeroTombo})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.livroId && <p className="text-xs text-destructive">{errors.livroId.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>Sócio *</Label>
        <Select onValueChange={(v) => setValue("socioId", String(v))}>
          <SelectTrigger><SelectValue placeholder="Selecione o sócio" /></SelectTrigger>
          <SelectContent>
            {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.fullName}</SelectItem>)}
          </SelectContent>
        </Select>
        {errors.socioId && <p className="text-xs text-destructive">{errors.socioId.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="retiradoEm">Data de retirada</Label>
          <Input id="retiradoEm" type="date" {...register("retiradoEm")} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="prazoDevolucao">Prazo de devolução</Label>
          <Input id="prazoDevolucao" type="date" {...register("prazoDevolucao")} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Estado na retirada</Label>
        <Select
          defaultValue="otimo"
          onValueChange={(v) => setValue("estadoRetirada", String(v) as FormValues["estadoRetirada"])}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="otimo">Ótimo</SelectItem>
            <SelectItem value="bom">Bom</SelectItem>
            <SelectItem value="regular">Regular</SelectItem>
            <SelectItem value="danificado">Danificado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" rows={2} {...register("observacoes")} />
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Registrando..." : "Registrar empréstimo"}
      </Button>
    </form>
  );
}

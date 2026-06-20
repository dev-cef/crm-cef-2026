"use client";

import { useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { z } from "zod";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { LivroFormValues } from "@/app/(app)/biblioteca/actions";
import { buscarPorIsbn } from "@/app/(app)/biblioteca/actions";
import { MemberCombobox } from "@/components/modules/biblioteca/member-combobox";
import type { BibliotecaCategoria, Member } from "@/app/generated/prisma/client";

const livroSchema = z.object({
  titulo: z.string().min(2, "Título obrigatório"),
  autor: z.string().optional(),
  editora: z.string().optional(),
  anoPublicacao: z.coerce.number().int().min(1800).max(2030).optional(),
  isbn: z.string().optional(),
  categoriaId: z.string().optional(),
  origem: z.enum(["proprio", "doacao"]),
  doadorNome: z.string().optional(),
  doadorSocioId: z.string().optional(),
  estado: z.enum(["otimo", "bom", "regular", "danificado", "perdido"]),
  descricao: z.string().optional(),
  capaUrl: z.string().optional(),
  observacoes: z.string().optional(),
  numeroTombo: z.string().optional(),
});

type FormValues = z.infer<typeof livroSchema>;

interface Props {
  defaultValues?: Partial<FormValues>;
  categorias: Pick<BibliotecaCategoria, "id" | "nome">[];
  membros: Pick<Member, "id" | "fullName">[];
  onSubmit: (v: LivroFormValues) => Promise<{ ok: boolean; error?: string; id?: string }>;
  submitLabel?: string;
  tomboSugerido?: string;
}

export function LivroForm({ defaultValues, categorias, membros, onSubmit, submitLabel = "Salvar", tomboSugerido }: Props) {
  const { register, handleSubmit, setValue, getValues, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: { estado: "otimo", origem: "proprio", ...defaultValues },
  });

  const origem = useWatch({ control, name: "origem", defaultValue: defaultValues?.origem ?? "proprio" });
  const doadorSocioIdWatch = useWatch({ control, name: "doadorSocioId", defaultValue: defaultValues?.doadorSocioId ?? "" });
  const [buscandoIsbn, setBuscandoIsbn] = useState(false);
  const [doadorEhSocio, setDoadorEhSocio] = useState(
    !!defaultValues?.doadorSocioId
  );

  async function handleBuscarIsbn() {
    const isbn = getValues("isbn");
    if (!isbn?.trim()) { toast.error("Digite um ISBN antes de buscar."); return; }
    setBuscandoIsbn(true);
    const result = await buscarPorIsbn(isbn);
    setBuscandoIsbn(false);
    if (!result.ok) { toast.error(result.error); return; }
    const d = result.data!;
    if (d.titulo)        setValue("titulo",        d.titulo);
    if (d.autor)         setValue("autor",         d.autor);
    if (d.editora)       setValue("editora",       d.editora);
    if (d.anoPublicacao) setValue("anoPublicacao", d.anoPublicacao);
    if (d.descricao)     setValue("descricao",     d.descricao);
    if (d.capaUrl)       setValue("capaUrl",       d.capaUrl);
    toast.success("Dados preenchidos a partir do Google Books!");
  }

  async function onValid(values: FormValues) {
    const result = await onSubmit(values as LivroFormValues);
    if (result.ok) {
      toast.success("Livro salvo com sucesso!");
    } else {
      toast.error(result.error ?? "Erro ao salvar o livro.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-6">
      {/* Identificação */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Identificação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" {...register("titulo")} />
            {errors.titulo && <p className="text-xs text-destructive">{errors.titulo.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="autor">Autor</Label>
            <Input id="autor" {...register("autor")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="editora">Editora</Label>
            <Input id="editora" {...register("editora")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="anoPublicacao">Ano de publicação</Label>
            <Input id="anoPublicacao" type="number" min={1800} max={2030} {...register("anoPublicacao")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="isbn">ISBN</Label>
            <div className="flex gap-2">
              <Input id="isbn" {...register("isbn")} placeholder="978-..." className="flex-1" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleBuscarIsbn}
                disabled={buscandoIsbn}
                title="Buscar no Google Books"
              >
                {buscandoIsbn ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Clique na lupa para preencher automaticamente pelo ISBN</p>
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select
              defaultValue={defaultValues?.categoriaId ?? ""}
              onValueChange={(v) => setValue("categoriaId", String(v) || undefined)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="numeroTombo">Número de tombo</Label>
            <Input id="numeroTombo" {...register("numeroTombo")} placeholder={tomboSugerido ?? "CEF-LIV-AAAA-NNN"} />
          </div>
        </div>
      </section>

      {/* Origem e Estado */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Origem e Estado</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Origem *</Label>
            <Select
              defaultValue={defaultValues?.origem ?? "proprio"}
              onValueChange={(v) => setValue("origem", String(v) as FormValues["origem"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="proprio">Próprio (compra / acervo)</SelectItem>
                <SelectItem value="doacao">Doação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Estado de conservação *</Label>
            <Select
              defaultValue={defaultValues?.estado ?? "otimo"}
              onValueChange={(v) => setValue("estado", String(v) as FormValues["estado"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="otimo">Ótimo</SelectItem>
                <SelectItem value="bom">Bom</SelectItem>
                <SelectItem value="regular">Regular</SelectItem>
                <SelectItem value="danificado">Danificado</SelectItem>
                <SelectItem value="perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {origem === "doacao" && (
            <div className="space-y-3 sm:col-span-2">
              <div className="flex items-center gap-3">
                <Label>O doador é sócio do CEF?</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setDoadorEhSocio(true); setValue("doadorNome", ""); }}
                    className={`px-3 py-1 rounded-md text-sm border transition-colors ${doadorEhSocio ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDoadorEhSocio(false); setValue("doadorSocioId", ""); }}
                    className={`px-3 py-1 rounded-md text-sm border transition-colors ${!doadorEhSocio ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >
                    Não
                  </button>
                </div>
              </div>

              {doadorEhSocio ? (
                <div className="space-y-1">
                  <Label>Selecionar sócio</Label>
                  <MemberCombobox
                    membros={membros}
                    value={doadorSocioIdWatch || undefined}
                    onChange={(id) => setValue("doadorSocioId", id ?? "")}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="doadorNome">Nome ou instituição doadora</Label>
                  <Controller
                    control={control}
                    name="doadorNome"
                    defaultValue={defaultValues?.doadorNome ?? ""}
                    render={({ field }) => (
                      <Input id="doadorNome" {...field} placeholder="Ex: João Silva, Editora XYZ, Prefeitura Municipal..." />
                    )}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Informações adicionais */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Informações adicionais</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="capaUrl">URL da capa</Label>
            <Input id="capaUrl" {...register("capaUrl")} placeholder="https://..." />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="descricao">Descrição / Sinopse</Label>
            <Textarea id="descricao" rows={3} {...register("descricao")} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" rows={2} {...register("observacoes")} />
          </div>
        </div>
      </section>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}

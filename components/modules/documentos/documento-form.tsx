"use client";

import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { DocumentoFormValues } from "@/app/(app)/documentos/actions";
import {
  DOC_NIVEIS,
  DOC_NIVEL_DESCRICOES,
  DOC_NIVEL_LABELS,
  DOC_STATUS,
  DOC_STATUS_LABELS,
} from "@/lib/documentos/types";

interface Props {
  defaultValues?: Partial<DocumentoFormValues>;
  categorias: { id: string; nome: string }[];
  isAdmin: boolean;
  onSubmit: (v: DocumentoFormValues) => Promise<{ ok: boolean; error?: string; id?: string }>;
  submitLabel?: string;
  documentoId?: string; // definido no modo edição
}

export function DocumentoForm({
  defaultValues,
  categorias,
  isAdmin,
  onSubmit,
  submitLabel = "Salvar",
  documentoId,
}: Props) {
  const router = useRouter();
  const hoje = new Date().toISOString().slice(0, 10);

  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting } } =
    useForm<DocumentoFormValues>({
      defaultValues: {
        status: "ATIVO",
        nivelAcesso: "ASSOCIADOS",
        permitirDownload: true,
        versao: "1.0",
        publicadoEm: hoje,
        ...defaultValues,
      },
    });

  const permitirDownload = useWatch({ control, name: "permitirDownload" });
  const nivelAcesso = useWatch({ control, name: "nivelAcesso" });
  const driveUrl = useWatch({ control, name: "driveUrl" });

  // DEPARTAMENTO não pode definir o nível confidencial (somente admins).
  const niveis = DOC_NIVEIS.filter((n) => isAdmin || n !== "ADMIN");

  async function onValid(values: DocumentoFormValues) {
    const result = await onSubmit(values);
    if (result.ok) {
      toast.success("Documento salvo com sucesso!");
      router.push(`/documentos/${documentoId ?? result.id}`);
      router.refresh();
    } else {
      toast.error(result.error ?? "Erro ao salvar o documento.");
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
            <Input id="titulo" {...register("titulo", { required: "Título obrigatório" })} placeholder="Ex: Estatuto do CEF — 2026" />
            {errors.titulo && <p className="text-xs text-destructive">{errors.titulo.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Categoria *</Label>
            <Select
              defaultValue={defaultValues?.categoriaId ?? ""}
              onValueChange={(v) => setValue("categoriaId", String(v))}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <input type="hidden" {...register("categoriaId", { required: "Categoria obrigatória" })} />
            {errors.categoriaId && <p className="text-xs text-destructive">{errors.categoriaId.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="versao">Versão *</Label>
            <Input id="versao" {...register("versao", { required: "Versão obrigatória" })} placeholder="Ex: 1.0" />
            {errors.versao && <p className="text-xs text-destructive">{errors.versao.message}</p>}
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" rows={3} {...register("descricao")} placeholder="Resumo do conteúdo do documento" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="tags">Tags / palavras-chave</Label>
            <Input id="tags" {...register("tags")} placeholder="Separadas por vírgula. Ex: estatuto, assembleia, 2026" />
          </div>
        </div>
      </section>

      {/* Arquivo no Google Drive */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Arquivo no Google Drive</h2>
        <div className="space-y-1">
          <Label htmlFor="driveUrl">Link do Google Drive *</Label>
          <div className="flex gap-2">
            <Input
              id="driveUrl"
              {...register("driveUrl", { required: "Link do Google Drive obrigatório" })}
              placeholder="https://drive.google.com/file/d/..."
              className="flex-1"
            />
            {driveUrl && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Abrir link em nova aba"
                onClick={() => window.open(driveUrl, "_blank", "noopener")}
              >
                <ExternalLink className="size-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            O arquivo permanece no Drive institucional do CEF — o CRM guarda apenas o link.
          </p>
          {errors.driveUrl && <p className="text-xs text-destructive">{errors.driveUrl.message}</p>}
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="permitirDownload"
            checked={!!permitirDownload}
            onCheckedChange={(v) => setValue("permitirDownload", !!v)}
          />
          <Label htmlFor="permitirDownload">Permitir download pelos associados</Label>
        </div>
      </section>

      {/* Publicação e Acesso */}
      <section className="rounded-xl border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Publicação e Acesso</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="publicadoEm">Data de publicação *</Label>
            <Input id="publicadoEm" type="date" {...register("publicadoEm", { required: "Data de publicação obrigatória" })} />
            {errors.publicadoEm && <p className="text-xs text-destructive">{errors.publicadoEm.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="validadeEm">Data de validade</Label>
            <Input id="validadeEm" type="date" {...register("validadeEm")} />
            <p className="text-xs text-muted-foreground">Opcional — ex: editais com prazo</p>
          </div>
          <div className="space-y-1">
            <Label>Status *</Label>
            <Select
              defaultValue={defaultValues?.status ?? "ATIVO"}
              onValueChange={(v) => setValue("status", String(v) as DocumentoFormValues["status"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_STATUS.map((s) => (
                  <SelectItem key={s} value={s}>{DOC_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Nível de acesso *</Label>
            <Select
              defaultValue={defaultValues?.nivelAcesso ?? "ASSOCIADOS"}
              onValueChange={(v) => setValue("nivelAcesso", String(v) as DocumentoFormValues["nivelAcesso"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {niveis.map((n) => (
                  <SelectItem key={n} value={n}>{DOC_NIVEL_LABELS[n]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {nivelAcesso && (
              <p className="text-xs text-muted-foreground">
                {DOC_NIVEL_DESCRICOES[nivelAcesso as keyof typeof DOC_NIVEL_DESCRICOES]}
              </p>
            )}
          </div>
        </div>
      </section>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}

"use client";

import { useTransition, useState, useEffect } from "react";
import { toast } from "sonner";
import { criarDepartamento, editarDepartamento } from "@/app/(app)/configuracoes/departamentos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#3b82f6", "#06b6d4", "#64748b", "#1e293b",
];

interface DeptData {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  color: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: DeptData | null;
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function DeptFormModal({ open, onClose, editing }: Props) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setSlug(editing.slug);
      setDescription(editing.description ?? "");
      setColor(editing.color);
      setSlugTouched(true);
    } else {
      setName(""); setSlug(""); setDescription(""); setColor("#6366f1"); setSlugTouched(false);
    }
  }, [editing, open]);

  function handleNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(toSlug(v));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const payload = { name, slug, description: description || undefined, color };
      const r = editing
        ? await editarDepartamento(editing.id, payload)
        : await criarDepartamento(payload);
      if (r.ok) {
        toast.success(editing ? "Departamento atualizado." : "Departamento criado.");
        onClose();
      } else {
        toast.error(r.error ?? "Falha.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar departamento" : "Novo departamento"}</DialogTitle>
          <DialogDescription>
            {editing ? "Altere os dados do departamento." : "Preencha os dados para criar um novo departamento."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="dept-name">Nome *</Label>
            <Input
              id="dept-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Trilhas e Caminhadas"
              required
            />
          </div>
          <div>
            <Label htmlFor="dept-slug">Slug (identificador) *</Label>
            <Input
              id="dept-slug"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="trilhas-e-caminhadas"
              pattern="[a-z0-9-]+"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">Apenas letras minúsculas, números e hífens.</p>
          </div>
          <div>
            <Label htmlFor="dept-desc">Descrição</Label>
            <Input
              id="dept-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição das atividades"
              maxLength={200}
            />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="size-7 rounded-full ring-offset-2 transition-all"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : editing ? "Salvar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

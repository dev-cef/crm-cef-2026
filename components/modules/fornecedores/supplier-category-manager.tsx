"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Pencil, Check, X, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import {
  createSupplierCategory,
  renameSupplierCategory,
  deleteSupplierCategory,
  reorderSupplierCategories,
} from "@/app/(app)/fornecedores/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Category = { id: string; name: string; order: number };

export function SupplierCategoryManager({
  initialCategories,
}: {
  initialCategories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function refresh() { router.refresh(); }

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await createSupplierCategory(trimmed);
      if (res.ok) { toast.success("Categoria criada."); setNewName(""); refresh(); }
      else toast.error(res.error ?? "Erro ao criar.");
    });
  }

  function handleRename() {
    if (!renaming) return;
    startTransition(async () => {
      const res = await renameSupplierCategory(renaming.id, renaming.value);
      if (res.ok) { toast.success("Categoria renomeada."); setRenaming(null); refresh(); }
      else toast.error(res.error ?? "Erro ao renomear.");
    });
  }

  function handleDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      const res = await deleteSupplierCategory(deleteId);
      if (res.ok) { toast.success("Categoria excluída."); setDeleteId(null); refresh(); }
      else toast.error(res.error ?? "Erro ao excluir.");
    });
  }

  function handleMove(cats: Category[], idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= cats.length) return;
    const reordered = [...cats];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    startTransition(async () => {
      const res = await reorderSupplierCategories(reordered.map((c) => c.id));
      if (res.ok) refresh();
      else toast.error(res.error ?? "Erro ao reordenar.");
    });
  }

  const cats = initialCategories;

  return (
    <>
      <div className="mt-6 max-w-lg space-y-2">
        {cats.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
        )}

        {cats.map((cat, idx) => {
          const isRenaming = renaming?.id === cat.id;
          return (
            <div key={cat.id} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5">
              {isRenaming ? (
                <Input
                  className="h-7 flex-1 text-sm"
                  value={renaming.value}
                  onChange={(e) => setRenaming((p) => p && { ...p, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setRenaming(null);
                  }}
                  autoFocus
                  disabled={pending}
                />
              ) : (
                <span className="flex-1 text-sm font-medium">{cat.name}</span>
              )}

              {isRenaming ? (
                <>
                  <Button size="icon-sm" variant="ghost" onClick={handleRename} disabled={pending} className="text-green-600 hover:text-green-600 hover:bg-green-600/10">
                    {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => setRenaming(null)} disabled={pending}>
                    <X className="size-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button size="icon-sm" variant="ghost" className="text-muted-foreground" disabled={pending || idx === 0} onClick={() => handleMove(cats, idx, -1)} aria-label="Mover para cima">
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" className="text-muted-foreground" disabled={pending || idx === cats.length - 1} onClick={() => handleMove(cats, idx, 1)} aria-label="Mover para baixo">
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => setRenaming({ id: cat.id, value: cat.name })} aria-label={`Renomear ${cat.name}`}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(cat.id)} aria-label={`Excluir ${cat.name}`}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </div>
          );
        })}

        {/* Add */}
        <div className="flex gap-2 pt-2">
          <Input
            placeholder="Nova categoria…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            disabled={pending}
          />
          <Button onClick={handleAdd} disabled={pending || !newName.trim()} className="shrink-0">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Adicionar
          </Button>
        </div>
      </div>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir categoria?</DialogTitle>
            <DialogDescription>
              Categorias em uso por fornecedores não podem ser excluídas. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancelar</DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

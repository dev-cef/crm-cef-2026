"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Loader2, ChevronDown, ChevronRight,
  Tag, Tags, Pencil, Check, X, ArrowUp, ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  createTransactionCategory,
  deleteTransactionCategory,
  createTransactionSubcategory,
  deleteTransactionSubcategory,
  renameTransactionCategory,
  renameTransactionSubcategory,
  reorderTransactionCategories,
  reorderTransactionSubcategories,
  type CategoryWithSubs,
} from "@/app/(app)/financeiro/actions";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CategoriesData = { ENTRADA: CategoryWithSubs[]; SAIDA: CategoryWithSubs[] };

export function CategoryManager({ initialCategories }: { initialCategories: CategoriesData }) {
  const router = useRouter();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [newCatName, setNewCatName] = useState<Record<"ENTRADA" | "SAIDA", string>>({ ENTRADA: "", SAIDA: "" });
  const [newSubName, setNewSubName] = useState<Record<string, string>>({});

  // Rename state: { id, currentName, value }
  const [renameCat, setRenameCat] = useState<{ id: string; value: string } | null>(null);
  const [renameSub, setRenameSub] = useState<{ id: string; value: string } | null>(null);

  // Delete confirm state
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [deleteSubId, setDeleteSubId] = useState<string | null>(null);

  const [pending, startTransition] = useTransition();
  const renameInputRef = useRef<HTMLInputElement>(null);

  function refresh() { router.refresh(); }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Add category ────────────────────────────────────────────
  function handleAddCategory(type: "ENTRADA" | "SAIDA") {
    const name = newCatName[type].trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createTransactionCategory(type, name);
      if (res.ok) { toast.success("Categoria criada."); setNewCatName((p) => ({ ...p, [type]: "" })); refresh(); }
      else toast.error(res.error ?? "Erro ao criar.");
    });
  }

  // ── Delete category ─────────────────────────────────────────
  function handleDeleteCategory() {
    if (!deleteCatId) return;
    startTransition(async () => {
      const res = await deleteTransactionCategory(deleteCatId);
      if (res.ok) { toast.success("Categoria excluída."); setDeleteCatId(null); refresh(); }
      else toast.error(res.error ?? "Erro ao excluir.");
    });
  }

  // ── Rename category ─────────────────────────────────────────
  function handleRenameCategory() {
    if (!renameCat) return;
    startTransition(async () => {
      const res = await renameTransactionCategory(renameCat.id, renameCat.value);
      if (res.ok) { toast.success("Categoria renomeada."); setRenameCat(null); refresh(); }
      else toast.error(res.error ?? "Erro ao renomear.");
    });
  }

  // ── Reorder category ────────────────────────────────────────
  function handleMoveCat(cats: CategoryWithSubs[], idx: number, dir: -1 | 1, type: "ENTRADA" | "SAIDA") {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= cats.length) return;
    const reordered = [...cats];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    startTransition(async () => {
      const res = await reorderTransactionCategories(type, reordered.map((c) => c.id));
      if (res.ok) refresh();
      else toast.error(res.error ?? "Erro ao reordenar.");
    });
  }

  // ── Add subcategory ─────────────────────────────────────────
  function handleAddSubcategory(categoryId: string) {
    const name = (newSubName[categoryId] ?? "").trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createTransactionSubcategory(categoryId, name);
      if (res.ok) { toast.success("Subcategoria criada."); setNewSubName((p) => ({ ...p, [categoryId]: "" })); refresh(); }
      else toast.error(res.error ?? "Erro ao criar.");
    });
  }

  // ── Delete subcategory ──────────────────────────────────────
  function handleDeleteSubcategory() {
    if (!deleteSubId) return;
    startTransition(async () => {
      const res = await deleteTransactionSubcategory(deleteSubId);
      if (res.ok) { toast.success("Subcategoria excluída."); setDeleteSubId(null); refresh(); }
      else toast.error(res.error ?? "Erro ao excluir.");
    });
  }

  // ── Rename subcategory ──────────────────────────────────────
  function handleRenameSub() {
    if (!renameSub) return;
    startTransition(async () => {
      const res = await renameTransactionSubcategory(renameSub.id, renameSub.value);
      if (res.ok) { toast.success("Subcategoria renomeada."); setRenameSub(null); refresh(); }
      else toast.error(res.error ?? "Erro ao renomear.");
    });
  }

  // ── Reorder subcategory ─────────────────────────────────────
  function handleMoveSub(subs: CategoryWithSubs["subcategories"], catId: string, idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= subs.length) return;
    const reordered = [...subs];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    startTransition(async () => {
      const res = await reorderTransactionSubcategories(catId, reordered.map((s) => s.id));
      if (res.ok) refresh();
      else toast.error(res.error ?? "Erro ao reordenar.");
    });
  }

  // ── Column renderer ─────────────────────────────────────────
  function renderColumn(type: "ENTRADA" | "SAIDA", cats: CategoryWithSubs[]) {
    const isEntry = type === "ENTRADA";
    const colorBadge = isEntry
      ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
      : "border-destructive/30 bg-destructive/10 text-destructive";

    return (
      <div className="flex-1 min-w-0">
        {/* Column header */}
        <div className="flex items-center gap-2 mb-4">
          <Tags className={cn("size-4", isEntry ? "text-green-600" : "text-destructive")} />
          <h2 className="font-semibold text-base">{isEntry ? "Entradas" : "Saídas"}</h2>
          <Badge variant="outline" className={colorBadge}>
            {cats.length} {cats.length === 1 ? "categoria" : "categorias"}
          </Badge>
        </div>

        <div className="space-y-2">
          {cats.map((cat, catIdx) => {
            const expanded = expandedIds.has(cat.id);
            const isRenamingCat = renameCat?.id === cat.id;

            return (
              <div key={cat.id} className="rounded-xl border bg-card">
                {/* Category row */}
                <div className="flex items-center gap-1.5 px-3 py-2.5">
                  {/* Expand toggle */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(cat.id)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={expanded ? "Fechar" : "Expandir"}
                  >
                    {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  </button>

                  <Tag className="size-4 shrink-0 text-muted-foreground" />

                  {/* Name / rename input */}
                  {isRenamingCat ? (
                    <Input
                      ref={renameInputRef}
                      className="h-7 flex-1 text-sm"
                      value={renameCat.value}
                      onChange={(e) => setRenameCat((p) => p && { ...p, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameCategory();
                        if (e.key === "Escape") setRenameCat(null);
                      }}
                      autoFocus
                      disabled={pending}
                    />
                  ) : (
                    <span className="flex-1 text-sm font-medium truncate">{cat.name}</span>
                  )}

                  {/* Sub count badge */}
                  {!isRenamingCat && (
                    <Badge variant="outline" className="text-xs tabular-nums shrink-0">
                      {cat.subcategories.length}
                    </Badge>
                  )}

                  {/* Actions */}
                  {isRenamingCat ? (
                    <>
                      <Button size="icon-sm" variant="ghost" onClick={handleRenameCategory} disabled={pending} className="text-green-600 hover:text-green-600 hover:bg-green-600/10 shrink-0">
                        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => setRenameCat(null)} disabled={pending} className="shrink-0">
                        <X className="size-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      {/* Reorder */}
                      <Button size="icon-sm" variant="ghost" className="shrink-0 text-muted-foreground" disabled={pending || catIdx === 0} onClick={() => handleMoveCat(cats, catIdx, -1, type)} aria-label="Mover para cima">
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" className="shrink-0 text-muted-foreground" disabled={pending || catIdx === cats.length - 1} onClick={() => handleMoveCat(cats, catIdx, 1, type)} aria-label="Mover para baixo">
                        <ArrowDown className="size-3.5" />
                      </Button>
                      {/* Rename */}
                      <Button size="icon-sm" variant="ghost" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setRenameCat({ id: cat.id, value: cat.name })} aria-label={`Renomear ${cat.name}`}>
                        <Pencil className="size-3.5" />
                      </Button>
                      {/* Delete */}
                      <Button size="icon-sm" variant="ghost" className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteCatId(cat.id)} aria-label={`Excluir ${cat.name}`}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Subcategories */}
                {expanded && (
                  <div className="border-t px-4 py-3 space-y-1">
                    {cat.subcategories.length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-1">Sem subcategorias</p>
                    )}

                    {cat.subcategories.map((sub, subIdx) => {
                      const isRenamingSub = renameSub?.id === sub.id;
                      return (
                        <div key={sub.id} className="flex items-center gap-1.5">
                          <span className="ml-2 h-px w-3 bg-border shrink-0" />

                          {isRenamingSub ? (
                            <Input
                              className="h-6 flex-1 text-xs"
                              value={renameSub.value}
                              onChange={(e) => setRenameSub((p) => p && { ...p, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameSub();
                                if (e.key === "Escape") setRenameSub(null);
                              }}
                              autoFocus
                              disabled={pending}
                            />
                          ) : (
                            <span className="flex-1 text-sm text-muted-foreground truncate">{sub.name}</span>
                          )}

                          {isRenamingSub ? (
                            <>
                              <Button size="icon-sm" variant="ghost" onClick={handleRenameSub} disabled={pending} className="text-green-600 hover:text-green-600 hover:bg-green-600/10 shrink-0">
                                {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                              </Button>
                              <Button size="icon-sm" variant="ghost" onClick={() => setRenameSub(null)} disabled={pending} className="shrink-0">
                                <X className="size-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="icon-sm" variant="ghost" className="shrink-0 text-muted-foreground" disabled={pending || subIdx === 0} onClick={() => handleMoveSub(cat.subcategories, cat.id, subIdx, -1)} aria-label="Mover para cima">
                                <ArrowUp className="size-3" />
                              </Button>
                              <Button size="icon-sm" variant="ghost" className="shrink-0 text-muted-foreground" disabled={pending || subIdx === cat.subcategories.length - 1} onClick={() => handleMoveSub(cat.subcategories, cat.id, subIdx, 1)} aria-label="Mover para baixo">
                                <ArrowDown className="size-3" />
                              </Button>
                              <Button size="icon-sm" variant="ghost" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => setRenameSub({ id: sub.id, value: sub.name })} aria-label={`Renomear ${sub.name}`}>
                                <Pencil className="size-3" />
                              </Button>
                              <Button size="icon-sm" variant="ghost" className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteSubId(sub.id)} aria-label={`Excluir ${sub.name}`}>
                                <Trash2 className="size-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* Add subcategory */}
                    <div className="flex items-center gap-1.5 pt-2">
                      <span className="ml-2 h-px w-3 bg-border shrink-0" />
                      <Input
                        className="h-7 text-xs flex-1"
                        placeholder="Nova subcategoria…"
                        value={newSubName[cat.id] ?? ""}
                        onChange={(e) => setNewSubName((p) => ({ ...p, [cat.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddSubcategory(cat.id); }}
                        disabled={pending}
                      />
                      <Button size="icon-sm" variant="outline" onClick={() => handleAddSubcategory(cat.id)} disabled={pending || !(newSubName[cat.id] ?? "").trim()} aria-label="Adicionar subcategoria">
                        {pending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add category */}
        <div className="mt-3 flex items-center gap-2">
          <Input
            placeholder={`Nova categoria de ${isEntry ? "entrada" : "saída"}…`}
            value={newCatName[type]}
            onChange={(e) => setNewCatName((p) => ({ ...p, [type]: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddCategory(type); }}
            disabled={pending}
          />
          <Button
            variant={isEntry ? "default" : "destructive"}
            size="sm"
            onClick={() => handleAddCategory(type)}
            disabled={pending || !newCatName[type].trim()}
            className="shrink-0"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Adicionar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:gap-8">
        {renderColumn("ENTRADA", initialCategories.ENTRADA)}
        <div className="hidden md:block w-px bg-border" />
        {renderColumn("SAIDA", initialCategories.SAIDA)}
      </div>

      {/* Delete category modal */}
      <Dialog open={!!deleteCatId} onOpenChange={(v) => !v && setDeleteCatId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir categoria?</DialogTitle>
            <DialogDescription>
              Todas as subcategorias desta categoria também serão excluídas. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancelar</DialogClose>
            <Button variant="destructive" onClick={handleDeleteCategory} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete subcategory modal */}
      <Dialog open={!!deleteSubId} onOpenChange={(v) => !v && setDeleteSubId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir subcategoria?</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancelar</DialogClose>
            <Button variant="destructive" onClick={handleDeleteSubcategory} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

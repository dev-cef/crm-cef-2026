"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, ChevronDown, ChevronRight, Tag, Tags } from "lucide-react";
import { toast } from "sonner";
import {
  createTransactionCategory,
  deleteTransactionCategory,
  createTransactionSubcategory,
  deleteTransactionSubcategory,
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
  const [categories, setCategories] = useState(initialCategories);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [newCatName, setNewCatName] = useState<Record<"ENTRADA" | "SAIDA", string>>({ ENTRADA: "", SAIDA: "" });
  const [newSubName, setNewSubName] = useState<Record<string, string>>({});
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);
  const [deleteSubId, setDeleteSubId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAddCategory(type: "ENTRADA" | "SAIDA") {
    const name = newCatName[type].trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createTransactionCategory(type, name);
      if (res.ok) {
        toast.success("Categoria criada.");
        setNewCatName((p) => ({ ...p, [type]: "" }));
        refresh();
      } else {
        toast.error(res.error ?? "Erro ao criar categoria.");
      }
    });
  }

  function handleDeleteCategory() {
    if (!deleteCatId) return;
    startTransition(async () => {
      const res = await deleteTransactionCategory(deleteCatId);
      if (res.ok) {
        toast.success("Categoria excluída.");
        setDeleteCatId(null);
        refresh();
      } else {
        toast.error(res.error ?? "Erro ao excluir.");
      }
    });
  }

  function handleAddSubcategory(categoryId: string) {
    const name = (newSubName[categoryId] ?? "").trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createTransactionSubcategory(categoryId, name);
      if (res.ok) {
        toast.success("Subcategoria criada.");
        setNewSubName((p) => ({ ...p, [categoryId]: "" }));
        refresh();
      } else {
        toast.error(res.error ?? "Erro ao criar subcategoria.");
      }
    });
  }

  function handleDeleteSubcategory() {
    if (!deleteSubId) return;
    startTransition(async () => {
      const res = await deleteTransactionSubcategory(deleteSubId);
      if (res.ok) {
        toast.success("Subcategoria excluída.");
        setDeleteSubId(null);
        refresh();
      } else {
        toast.error(res.error ?? "Erro ao excluir.");
      }
    });
  }

  function renderColumn(type: "ENTRADA" | "SAIDA") {
    const cats = categories[type];
    const isEntry = type === "ENTRADA";
    const colorBadge = isEntry
      ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
      : "border-destructive/30 bg-destructive/10 text-destructive";
    const addBtnVariant = isEntry ? "default" : "destructive";

    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-4">
          <Tags className={cn("size-4", isEntry ? "text-green-600" : "text-destructive")} />
          <h2 className="font-semibold text-base">
            {isEntry ? "Entradas" : "Saídas"}
          </h2>
          <Badge variant="outline" className={colorBadge}>
            {cats.length} {cats.length === 1 ? "categoria" : "categorias"}
          </Badge>
        </div>

        <div className="space-y-2">
          {cats.map((cat) => {
            const expanded = expandedIds.has(cat.id);
            return (
              <div key={cat.id} className="rounded-xl border bg-card">
                {/* Category header */}
                <div className="flex items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleExpand(cat.id)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={expanded ? "Fechar" : "Expandir"}
                  >
                    {expanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  <Tag className="size-4 text-muted-foreground" />
                  <span className="flex-1 font-medium text-sm">{cat.name}</span>
                  <Badge variant="outline" className="text-xs tabular-nums">
                    {cat.subcategories.length}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteCatId(cat.id)}
                    aria-label={`Excluir ${cat.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {/* Subcategories */}
                {expanded && (
                  <div className="border-t px-4 py-3 space-y-1.5">
                    {cat.subcategories.length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-1">
                        Sem subcategorias
                      </p>
                    )}
                    {cat.subcategories.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2">
                        <span className="ml-2 h-px w-3 bg-border shrink-0" />
                        <span className="flex-1 text-sm text-muted-foreground">{sub.name}</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => setDeleteSubId(sub.id)}
                          aria-label={`Excluir ${sub.name}`}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    ))}

                    {/* Add subcategory inline */}
                    <div className="flex items-center gap-2 pt-2">
                      <span className="ml-2 h-px w-3 bg-border shrink-0" />
                      <Input
                        className="h-7 text-xs"
                        placeholder="Nova subcategoria…"
                        value={newSubName[cat.id] ?? ""}
                        onChange={(e) =>
                          setNewSubName((p) => ({ ...p, [cat.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddSubcategory(cat.id);
                        }}
                        disabled={pending}
                      />
                      <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => handleAddSubcategory(cat.id)}
                        disabled={pending || !(newSubName[cat.id] ?? "").trim()}
                        aria-label="Adicionar subcategoria"
                      >
                        {pending ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Plus className="size-3" />
                        )}
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
            onChange={(e) =>
              setNewCatName((p) => ({ ...p, [type]: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCategory(type);
            }}
            disabled={pending}
          />
          <Button
            variant={addBtnVariant}
            size="sm"
            onClick={() => handleAddCategory(type)}
            disabled={pending || !newCatName[type].trim()}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Adicionar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:gap-8">
        {renderColumn("ENTRADA")}
        <div className="hidden md:block w-px bg-border" />
        {renderColumn("SAIDA")}
      </div>

      {/* Confirm delete category */}
      <Dialog open={!!deleteCatId} onOpenChange={(v) => !v && setDeleteCatId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir categoria?</DialogTitle>
            <DialogDescription>
              Todas as subcategorias desta categoria também serão excluídas. Esta ação não pode
              ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>
              Cancelar
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteCategory} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete subcategory */}
      <Dialog open={!!deleteSubId} onOpenChange={(v) => !v && setDeleteSubId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir subcategoria?</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>
              Cancelar
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteSubcategory} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

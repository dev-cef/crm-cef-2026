"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Power, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toggleSupplier, deleteSupplier } from "@/app/(app)/fornecedores/actions";
import { SupplierDialog } from "./supplier-dialog";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SupplierRow = {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  notes: string | null;
  active: boolean;
};

export function SupplierActions({ supplier, isAdmin = false }: { supplier: SupplierRow; isAdmin?: boolean }) {
  const { can } = usePermissions();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const canEdit   = isAdmin || can("fornecedores", "edit");
  const canDelete = isAdmin || can("fornecedores", "delete");

  if (!canEdit && !canDelete) return null;

  function handleToggle() {
    startTransition(async () => {
      const res = await toggleSupplier(supplier.id);
      if (res.ok) {
        toast.success(supplier.active ? "Fornecedor desativado." : "Fornecedor ativado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao alterar status.");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteSupplier(supplier.id);
      if (res.ok) {
        toast.success("Fornecedor excluído.");
        setDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao excluir.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={
          <Button variant="ghost" size="icon-sm" aria-label="Ações">
            <MoreHorizontal className="size-4" />
          </Button>
        } />
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem className="cursor-pointer" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 size-4" /> Editar
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem className="cursor-pointer" onClick={handleToggle} disabled={pending}>
              <Power className="mr-2 size-4" />
              {supplier.active ? "Desativar" : "Ativar"}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 size-4" /> Excluir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <SupplierDialog
        supplier={supplier}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir fornecedor?</DialogTitle>
            <DialogDescription>
              <strong>{supplier.name}</strong> será removido permanentemente. Fornecedores
              vinculados a transações ou eventos não podem ser excluídos.
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTransaction } from "@/app/(app)/financeiro/actions";
import type { TransactionFormState } from "@/lib/validations/finance";
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
import { TransactionDialog } from "./transaction-dialog";

type Props = {
  id: string;
  initial: TransactionFormState;
};

export function TransactionRowActions({ id, initial }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteTransaction(id);
      if (res.ok) {
        toast.success("Transação excluída.");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao excluir.");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Ações"><MoreHorizontal className="size-4" /></Button>} />
        <DropdownMenuContent align="end">
          <TransactionDialog
            editId={id}
            initial={initial}
            defaultType={initial.type as "ENTRADA" | "SAIDA"}
            trigger={
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="cursor-pointer"
              >
                <Pencil className="mr-2 size-4" /> Editar
              </DropdownMenuItem>
            }
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:text-destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 className="mr-2 size-4" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir transação?</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" disabled={pending} />}>
              Cancelar
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

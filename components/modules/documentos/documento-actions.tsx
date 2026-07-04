"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { arquivarDocumento, excluirDocumento } from "@/app/(app)/documentos/actions";

export function DocumentoActions({
  id,
  titulo,
  status,
  canEdit,
  canDelete,
}: {
  id: string;
  titulo: string;
  status: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const arquivado = status === "ARQUIVADO";

  async function handleArquivar() {
    setPending(true);
    const result = await arquivarDocumento(id);
    setPending(false);
    if (result.ok) {
      toast.success(arquivado ? "Documento reativado!" : "Documento arquivado!");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function handleExcluir() {
    setPending(true);
    const result = await excluirDocumento(id);
    setPending(false);
    if (result.ok) {
      toast.success("Documento excluído!");
      router.push("/documentos");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex gap-2">
      {canEdit && (
        <Button variant="outline" size="sm" onClick={handleArquivar} disabled={pending}>
          {arquivado ? (
            <><ArchiveRestore className="size-4 mr-1" /> Reativar</>
          ) : (
            <><Archive className="size-4 mr-1" /> Arquivar</>
          )}
        </Button>
      )}
      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                disabled={pending}
              />
            }
          >
            <Trash2 className="size-4 mr-1" /> Excluir
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
              <AlertDialogDescription>
                O registro <strong>{titulo}</strong> e seu histórico de versões serão removidos
                permanentemente do CRM. O arquivo no Google Drive não será afetado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleExcluir}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

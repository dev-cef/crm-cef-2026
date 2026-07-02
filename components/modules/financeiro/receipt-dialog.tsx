"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { toast } from "sonner";
import { rejectReceipt } from "@/app/(app)/financeiro/actions";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  paymentId: string;
  memberName: string;
  receiptPath: string;
  receiptSubmittedAt: string | null;
};

export function ReceiptDialog({
  open,
  onClose,
  paymentId,
  memberName,
  receiptPath,
  receiptSubmittedAt,
}: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isPdf = receiptPath.startsWith("data:application/pdf");

  function handleReject() {
    startTransition(async () => {
      const res = await rejectReceipt(paymentId);
      if (res.ok) {
        toast.success("Comprovante rejeitado. Cobrança voltou para pendente.");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Comprovante — {memberName}</DialogTitle>
          <DialogDescription>
            {receiptSubmittedAt ? `Enviado em ${formatDateTime(receiptSubmittedAt)}` : "Comprovante enviado pelo associado"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center rounded-md border bg-muted/30 p-2">
          {isPdf ? (
            <a
              href={receiptPath}
              download={`comprovante-${paymentId}.pdf`}
              className="text-sm font-medium text-primary underline"
            >
              Abrir PDF do comprovante
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={receiptPath}
              alt={`Comprovante enviado por ${memberName}`}
              className="max-h-[60vh] rounded-md object-contain"
            />
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Fechar
          </DialogClose>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleReject}>
            <XCircle className="size-4" /> Rejeitar comprovante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

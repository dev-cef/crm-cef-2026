"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { cancelPayment } from "@/app/(app)/financeiro/actions";
import { DarBaixaDialog } from "@/components/modules/financeiro/dar-baixa-dialog";
import { ReciboModal } from "@/components/modules/financeiro/recibo-modal";
import { usePermissions } from "@/hooks/usePermissions";

type Props = {
  id: string;
  status: string;
  memberName: string;
  memberCpf: string;
  planName: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  receiptNumber: string | null;
  notes: string | null;
};

export function PaymentRowActions({
  id,
  status,
  memberName,
  memberCpf,
  planName,
  amount,
  dueDate,
  paidAt,
  receiptNumber,
  notes,
}: Props) {
  const { can } = usePermissions();
  const router = useRouter();
  const [baixaOpen, setBaixaOpen] = useState(false);
  const [reciboOpen, setReciboOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const canEdit = can("financeiro", "edit");

  function handleCancel() {
    startTransition(async () => {
      const res = await cancelPayment(id);
      if (res.ok) {
        toast.success("Pagamento cancelado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro.");
      }
    });
  }

  const isPaid = status === "PAGO";

  return (
    <>
      <div className="flex items-center justify-end gap-3 text-xs font-medium">
        {!isPaid && (
          <>
            {canEdit && (
              <button
                type="button"
                onClick={() => setBaixaOpen(true)}
                className="flex items-center gap-1 text-green-600 hover:text-green-700 dark:text-green-500"
              >
                <CheckCircle2 className="size-3.5" /> Dar baixa
              </button>
            )}
            <button
              type="button"
              onClick={() => setReciboOpen(true)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <FileText className="size-3.5" /> Baixar e emitir recibo
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={pending}
                className="flex items-center gap-1 text-destructive hover:text-destructive/80 disabled:opacity-50"
              >
                <XCircle className="size-3.5" /> Cancelar
              </button>
            )}
          </>
        )}
        {isPaid && (
          <button
            type="button"
            onClick={() => setReciboOpen(true)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <FileText className="size-3.5" /> Emitir recibo
          </button>
        )}
      </div>

      <DarBaixaDialog
        open={baixaOpen}
        onClose={() => setBaixaOpen(false)}
        paymentId={id}
        memberName={memberName}
        amount={amount}
        dueDate={dueDate}
      />

      <ReciboModal
        open={reciboOpen}
        onClose={() => setReciboOpen(false)}
        paymentId={id}
        memberName={memberName}
        memberCpf={memberCpf}
        planName={planName}
        amount={amount}
        dueDate={dueDate}
        paidAt={paidAt}
        receiptNumber={receiptNumber}
        notes={notes}
      />
    </>
  );
}

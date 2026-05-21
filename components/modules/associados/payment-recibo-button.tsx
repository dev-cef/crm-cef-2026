"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { ReciboModal } from "@/components/modules/financeiro/recibo-modal";

type Props = {
  paymentId: string;
  memberName: string;
  memberCpf: string;
  planName: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  receiptNumber: string | null;
  notes: string | null;
};

export function PaymentReciboButton(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <FileText className="size-3.5" />
        Emitir recibo
      </button>
      <ReciboModal
        open={open}
        onClose={() => setOpen(false)}
        paymentId={props.paymentId}
        memberName={props.memberName}
        memberCpf={props.memberCpf}
        planName={props.planName}
        amount={props.amount}
        dueDate={props.dueDate}
        paidAt={props.paidAt}
        receiptNumber={props.receiptNumber}
        notes={props.notes}
      />
    </>
  );
}

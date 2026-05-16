"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setPaymentStatus } from "@/app/(app)/financeiro/actions";

const OPTIONS = ["PAGO", "PENDENTE", "ATRASADO"] as const;

export function PaymentStatus({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(value: string) {
    if (value === status) return;
    startTransition(async () => {
      const res = await setPaymentStatus(
        id,
        value as (typeof OPTIONS)[number],
      );
      if (res.ok) {
        toast.success("Pagamento atualizado.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro.");
      }
    });
  }

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => change(e.target.value)}
      className="h-8 rounded-md border bg-background px-2 text-xs outline-none disabled:opacity-50"
    >
      {OPTIONS.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

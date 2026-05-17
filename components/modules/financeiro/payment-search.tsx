"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Props = {
  period: string;
  statuses: string;
  q: string;
};

export function PaymentSearch({ period, statuses, q }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);

  function go(newQ: string) {
    const p = new URLSearchParams();
    if (period) p.set("period", period);
    if (statuses) p.set("statuses", statuses);
    if (newQ) p.set("q", newQ);
    router.push(`/financeiro/pagamentos?${p}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(ref.current?.value ?? "");
      }}
      className="relative flex-1"
    >
      <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <Input
        ref={ref}
        defaultValue={q}
        placeholder="Buscar por nome, CPF ou e-mail…"
        className="pl-8"
      />
    </form>
  );
}

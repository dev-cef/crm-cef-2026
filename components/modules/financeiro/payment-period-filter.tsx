"use client";

import { useRouter } from "next/navigation";

type Props = {
  period: string;
  statuses: string;
  q: string;
  options: { value: string; label: string }[];
};

export function PaymentPeriodFilter({ period, statuses, q, options }: Props) {
  const router = useRouter();

  function go(newPeriod: string) {
    const p = new URLSearchParams();
    p.set("period", newPeriod);
    if (statuses) p.set("statuses", statuses);
    if (q) p.set("q", q);
    router.push(`/financeiro/pagamentos?${p}`);
  }

  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Período
      </p>
      <select
        value={period}
        onChange={(e) => go(e.target.value)}
        className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm outline-none sm:w-72"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">
        {period === "ALL"
          ? "Exibindo valores de todo o período."
          : `Exibindo valores do período selecionado.`}
      </p>
    </div>
  );
}

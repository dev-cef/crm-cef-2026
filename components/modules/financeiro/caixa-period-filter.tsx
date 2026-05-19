"use client";

import { useRouter } from "next/navigation";

type Props = {
  period: string;
  type: string;
  options: { value: string; label: string }[];
};

export function CaixaPeriodFilter({ period, type, options }: Props) {
  const router = useRouter();

  function go(newPeriod: string) {
    const p = new URLSearchParams();
    p.set("period", newPeriod);
    if (type !== "ALL") p.set("type", type);
    router.push(`/financeiro/caixa?${p}`);
  }

  return (
    <select
      value={period}
      onChange={(e) => go(e.target.value)}
      className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

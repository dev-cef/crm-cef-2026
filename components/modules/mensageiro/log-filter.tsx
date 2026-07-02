"use client";

import { useRouter } from "next/navigation";

const OPTIONS = [
  { value: "ALL", label: "Todos os tipos" },
  { value: "ANIVERSARIO", label: "Aniversário" },
  { value: "COMPROVANTE_RECEBIDO", label: "Comprovante recebido" },
  { value: "PAGAMENTO_CONFIRMADO", label: "Pagamento confirmado" },
];

export function LogFilter({ type }: { type: string }) {
  const router = useRouter();

  function go(value: string) {
    const p = new URLSearchParams();
    if (value !== "ALL") p.set("type", value);
    const qs = p.toString();
    router.push(qs ? `/mensageiro?${qs}` : "/mensageiro");
  }

  return (
    <select
      value={type}
      onChange={(e) => go(e.target.value)}
      className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm outline-none sm:w-64"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

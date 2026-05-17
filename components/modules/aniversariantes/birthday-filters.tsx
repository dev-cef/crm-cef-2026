"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const selectCls =
  "h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring";

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

export function BirthdayFilters({
  period,
  month,
  sex,
  q,
  sort,
  dir,
}: {
  period: string;
  month: number;
  sex: string;
  q: string;
  sort: string;
  dir: string;
}) {
  const router = useRouter();

  function push(overrides: Record<string, string>) {
    const base: Record<string, string> = {
      period,
      month: String(month),
      sex,
      sort,
      dir,
      ...(q ? { q } : {}),
    };
    const params = new URLSearchParams({ ...base, ...overrides });
    router.push(`/aniversariantes?${params}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        name="period"
        value={period}
        onChange={(e) => push({ period: e.target.value })}
        className={selectCls}
      >
        <option value="dia">Hoje</option>
        <option value="semana">Próximos 7 dias</option>
        <option value="mes">Por mês</option>
        <option value="ano">Ano inteiro</option>
      </select>

      <select
        name="month"
        value={String(month)}
        onChange={(e) => push({ month: e.target.value })}
        className={selectCls}
      >
        {MONTHS.map((name, i) => (
          <option key={i + 1} value={i + 1}>
            {name}
          </option>
        ))}
      </select>

      <select
        name="sex"
        value={sex}
        onChange={(e) => push({ sex: e.target.value })}
        className={selectCls}
      >
        <option value="ALL">Todos os sexos</option>
        <option value="M">Masculino</option>
        <option value="F">Feminino</option>
      </select>

      <form
        method="get"
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          push({ q: (fd.get("q") as string) ?? "" });
        }}
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar nome…"
          className={cn(selectCls, "min-w-44 flex-1")}
        />
      </form>
    </div>
  );
}

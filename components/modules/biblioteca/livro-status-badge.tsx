import { cn } from "@/lib/utils";

export function LivroDisponibilidadeBadge({ disponivel, className }: { disponivel: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        disponivel
          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        className,
      )}
    >
      {disponivel ? "Disponível" : "Emprestado"}
    </span>
  );
}

export function LivroOrigemBadge({ origem, doadorNome }: { origem: string; doadorNome?: string | null }) {
  if (origem !== "doacao") return null;
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
      Doação{doadorNome ? ` — ${doadorNome}` : ""}
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  devolvido: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  atrasado: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  extraviado: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  devolvido: "Devolvido",
  atrasado: "Atrasado",
  extraviado: "Extraviado",
};

export function EmprestimoStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700")}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

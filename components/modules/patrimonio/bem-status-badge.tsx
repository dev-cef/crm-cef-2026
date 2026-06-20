import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type PatrimonioStatus } from "@/lib/patrimonio/types";
import { cn } from "@/lib/utils";

const STATUS_CLASSES: Record<PatrimonioStatus, string> = {
  disponivel: "bg-emerald-100 text-emerald-800 border-emerald-200",
  em_uso: "bg-blue-100 text-blue-800 border-blue-200",
  manutencao: "bg-orange-100 text-orange-800 border-orange-200",
  emprestado: "bg-amber-100 text-amber-800 border-amber-200",
  baixado: "bg-gray-100 text-gray-500 border-gray-200",
};

export function BemStatusBadge({ status }: { status: string }) {
  const s = status as PatrimonioStatus;
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", STATUS_CLASSES[s])}>
      {STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

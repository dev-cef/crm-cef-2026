import { Badge } from "@/components/ui/badge";
import { CATEGORIA_LABELS, type PatrimonioCategoria } from "@/lib/patrimonio/types";
import { cn } from "@/lib/utils";

const CATEGORIA_CLASSES: Record<PatrimonioCategoria, string> = {
  equipamento: "bg-green-50 text-green-700 border-green-200",
  movel_utensilio: "bg-purple-50 text-purple-700 border-purple-200",
  eletronico: "bg-sky-50 text-sky-700 border-sky-200",
};

export function BemCategoriaBadge({ categoria }: { categoria: string }) {
  const c = categoria as PatrimonioCategoria;
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", CATEGORIA_CLASSES[c])}>
      {CATEGORIA_LABELS[c] ?? categoria}
    </Badge>
  );
}

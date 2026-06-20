import { Package, Wrench, HandshakeIcon, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PatrimonioStats } from "@/lib/patrimonio/types";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PatrimonioStatsCards({ stats }: { stats: PatrimonioStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <Package className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total de bens</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-emerald-100 p-2">
            <DollarSign className="size-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">{fmt(stats.valorTotal)}</p>
            <p className="text-xs text-muted-foreground">Valor total</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-orange-100 p-2">
            <Wrench className="size-5 text-orange-700" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.emManutencao}</p>
            <p className="text-xs text-muted-foreground">Em manutenção</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-amber-100 p-2">
            <HandshakeIcon className="size-5 text-amber-700" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.emprestados}</p>
            <p className="text-xs text-muted-foreground">Emprestados</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

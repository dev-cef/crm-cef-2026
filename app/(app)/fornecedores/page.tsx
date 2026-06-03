import { Truck, Wrench, UtensilsCrossed, Briefcase } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ServerPermissionGate } from "@/components/auth/ServerPermissionGate";
import { SupplierDialog } from "@/components/modules/fornecedores/supplier-dialog";
import { SupplierActions } from "@/components/modules/fornecedores/supplier-actions";

export const dynamic = "force-dynamic";

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  TRANSPORTE:  { label: "Transporte / Van", icon: Truck,            cls: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  EQUIPAMENTO: { label: "Equipamentos",     icon: Wrench,           cls: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400" },
  ALIMENTACAO: { label: "Alimentação",      icon: UtensilsCrossed,  cls: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  SERVICO:     { label: "Serviços Gerais",  icon: Briefcase,        cls: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-400" },
};

export default async function FornecedoresPage() {
  const session = await auth();
  const isAdmin = session?.user ? toSessionUser(session.user).role === "ADMIN" : false;

  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { transactions: true, events: true } },
    },
  });

  const ativos   = suppliers.filter((s) => s.active).length;
  const inativos = suppliers.length - ativos;

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        description={`${suppliers.length} fornecedor(es) cadastrado(s)${inativos > 0 ? ` · ${inativos} inativo(s)` : ""}`}
      >
        <ServerPermissionGate module="fornecedores" action="create">
          <SupplierDialog />
        </ServerPermissionGate>
      </PageHeader>

      <div className="mt-6 rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="hidden md:table-cell">Telefone</TableHead>
              <TableHead className="hidden lg:table-cell">E-mail</TableHead>
              <TableHead className="hidden lg:table-cell">CNPJ / CPF</TableHead>
              <TableHead>Vínculos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum fornecedor cadastrado. Clique em "Novo fornecedor" para começar.
                </TableCell>
              </TableRow>
            )}
            {suppliers.map((s) => {
              const cfg = TYPE_CONFIG[s.type] ?? TYPE_CONFIG.SERVICO;
              const Icon = cfg.icon;
              return (
                <TableRow key={s.id} className={cn(!s.active && "opacity-50")}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("gap-1", cfg.cls)}>
                      <Icon className="size-3" />
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {s.phone ?? "—"}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {s.email ?? "—"}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    {s.document ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s._count.transactions > 0 && (
                      <span className="mr-2">{s._count.transactions} transação(ões)</span>
                    )}
                    {s._count.events > 0 && (
                      <span>{s._count.events} evento(s)</span>
                    )}
                    {s._count.transactions === 0 && s._count.events === 0 && "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.active ? "default" : "secondary"}>
                      {s.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <SupplierActions supplier={s} isAdmin={isAdmin} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

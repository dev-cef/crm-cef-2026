import Link from "next/link";
import { Search, Plus, Printer, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { membershipNumber } from "@/lib/membership";
import { cn } from "@/lib/utils";
import {
  isRequestWindowOpen,
  isIssuanceWindowOpen,
  nextRequestWindowDate,
  nextWindowLabel,
  currentMonth,
  currentYear,
  STAGE_LABELS,
  type PhysicalCardStage,
} from "@/lib/physical-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BatchIssueDialog } from "@/components/modules/carteirinha/batch-issue-dialog";
import { NewRequestDialog } from "@/components/modules/carteirinha/new-request-dialog";
import { BatchRequestDialog } from "@/components/modules/carteirinha/batch-request-dialog";

export const dynamic = "force-dynamic";

const STAGE_BADGE: Record<PhysicalCardStage, string> = {
  payment_pending:
    "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  minimum_requirements:
    "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  issuance_pending:
    "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  in_production:
    "border-blue-600/60 bg-blue-600/20 text-blue-800 dark:text-blue-300",
  awaiting_pickup:
    "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400",
  delivered:
    "border-border bg-muted text-muted-foreground",
  rejected:
    "border-destructive/40 bg-destructive/10 text-destructive",
};

const STATS: { stage: PhysicalCardStage; label: string }[] = [
  { stage: "payment_pending", label: "Ag. pagamento" },
  { stage: "minimum_requirements", label: "Pendentes" },
  { stage: "issuance_pending", label: "Aprovadas" },
  { stage: "in_production", label: "Em produção" },
  { stage: "awaiting_pickup", label: "Ag. retirada" },
  { stage: "delivered", label: "Entregues" },
];

export default async function FisicaDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string }>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const stageFilter = sp.stage ?? "ALL";

  const where: Record<string, unknown> = {};
  if (stageFilter !== "ALL") where.currentStage = stageFilter;
  if (q) {
    where.member = {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [requests, totals] = await Promise.all([
    prisma.physicalCardRequest.findMany({
      where,
      include: {
        member: { select: { fullName: true, registration: true, photoUrl: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.physicalCardRequest.groupBy({
      by: ["currentStage"],
      _count: { _all: true },
    }),
  ]);

  const countByStage = Object.fromEntries(
    totals.map((t) => [t.currentStage, t._count._all]),
  ) as Record<string, number>;

  const windowOpen = isRequestWindowOpen();
  const issuanceOpen = isIssuanceWindowOpen();
  const windowLabel = windowOpen
    ? "Janela ATIVA"
    : nextWindowLabel(() => nextRequestWindowDate(currentMonth(), currentYear()));

  // selecionados para emissão em lote (todos issuance_pending da listagem atual)
  const pendingIssue = requests.filter((r) => r.currentStage === "issuance_pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carteirinha Física"
        description="Administração do fluxo de emissão de carteirinhas físicas"
      >
        <Badge
          variant="outline"
          className={cn(
            "px-3 py-1 text-xs font-medium",
            windowOpen
              ? "border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-400"
              : "border-border text-muted-foreground",
          )}
        >
          {windowLabel}
        </Badge>
        <BatchRequestDialog
          trigger={
            <Button size="sm" variant="outline">
              <Users className="size-4" />
              Solicitar em lote
            </Button>
          }
        />
        <NewRequestDialog
          trigger={
            <Button size="sm" disabled={!windowOpen}>
              <Plus className="size-4" />
              Nova solicitação
            </Button>
          }
        />
      </PageHeader>

      {/* Totalizadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATS.map(({ stage, label }) => (
          <Link key={stage} href={`/carteirinha/fisica?stage=${stage}`}>
            <Card className={cn("transition-colors hover:bg-accent/40", stageFilter === stage && "ring-1 ring-primary")}>
              <CardHeader className="p-4 pb-1">
                <CardTitle className="text-2xl font-bold">
                  {countByStage[stage] ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <form method="get" className="flex flex-1 gap-2">
          {stageFilter !== "ALL" && (
            <input type="hidden" name="stage" value={stageFilter} />
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Buscar por nome do sócio"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Buscar
          </Button>
          {(q || stageFilter !== "ALL") && (
            <Link href="/carteirinha/fisica">
              <Button variant="ghost" size="sm" type="button">Limpar</Button>
            </Link>
          )}
        </form>

        {/* Emissão em lote */}
        {pendingIssue.length > 0 && issuanceOpen && (
          <BatchIssueDialog
            requestIds={pendingIssue.map((r) => r.id)}
            memberNames={pendingIssue.map((r) => r.member.fullName)}
            trigger={
              <Button variant="outline" size="sm">
                <Printer className="size-4" />
                Emitir {pendingIssue.length} em lote
              </Button>
            }
          />
        )}

        <Link href="/carteirinha/fisica/producao">
          <Button variant="outline" size="sm">
            <Printer className="size-4" />
            Lista de produção
          </Button>
        </Link>
      </div>

      {/* Tabela */}
      {requests.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma solicitação encontrada.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sócio</TableHead>
                <TableHead>Nº</TableHead>
                <TableHead>Trimestre</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Atualizado em</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => {
                const initials = r.member.fullName
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const stage = r.currentStage as PhysicalCardStage;

                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          <AvatarImage src={r.member.photoUrl ?? undefined} alt={r.member.fullName} />
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{r.member.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {membershipNumber(r.member.registration)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.quarter}º tri/{r.year}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          STAGE_BADGE[stage],
                        )}
                      >
                        {STAGE_LABELS[stage]}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.updatedAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Link href={`/carteirinha/fisica/${r.id}`}>
                        <Button variant="ghost" size="sm">Ver</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

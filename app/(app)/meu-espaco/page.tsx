import Link from "next/link";
import {
  CreditCard,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  ShieldCheck,
  Download,
  Pencil,
  Lock,
  ImagePlus,
  IdCard,
  Bell,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { formatCpf } from "@/lib/cpf";
import { formatBRL, monthName, toBrDate } from "@/lib/format";
import { membershipNumber, membershipValidity } from "@/lib/membership";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditarDadosDialog } from "./editar-dados-dialog";
import { TrocarSenhaDialog } from "./trocar-senha-dialog";
import { FotoDialog } from "./foto-dialog";
import { PhysicalCardStepper } from "@/components/modules/carteirinha/physical-card-stepper";
import { type PhysicalCardStage } from "@/lib/physical-card";

export const dynamic = "force-dynamic";

const PAYMENT_BADGE: Record<string, "default" | "secondary" | "destructive"> = {
  PAGO: "default",
  PENDENTE: "secondary",
  ATRASADO: "destructive",
};

export default async function MeuEspacoPage() {
  const user = await requireUser();

  const member = user.memberId
    ? await prisma.member.findUnique({
        where: { id: user.memberId },
        include: {
          plan: true,
          payments: {
            orderBy: [{ referenceYear: "desc" }, { referenceMonth: "desc" }],
          },
          physicalCardRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              statusHistory: { orderBy: { changedAt: "asc" } },
            },
          },
        },
      })
    : null;

  if (!member) {
    return (
      <div className="space-y-6">
        <PageHeader title="Meu Espaço" />
        <Card>
          <CardHeader>
            <CardTitle>Sem cadastro vinculado</CardTitle>
            <CardDescription>
              Sua conta ainda não está vinculada a um cadastro de associado.
              Procure a administração do clube.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const initials = member.fullName
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const validity = member.cardValidUntil ?? membershipValidity();
  const pending = member.payments.filter(
    (p) => p.status === "PENDENTE" || p.status === "ATRASADO",
  );
  const emDia = pending.length === 0;
  const pendingTotal = pending.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Meu Espaço" />

      <div className="grid gap-4 md:grid-cols-3">
        {/* Cartão do associado */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                {member.photoUrl ? (
                  <AvatarImage src={member.photoUrl} alt={member.fullName} />
                ) : null}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="truncate text-xl">
                  {member.fullName}
                </CardTitle>
                <CardDescription>
                  Matrícula {membershipNumber(member.registration)} ·{" "}
                  {formatCpf(member.cpf)}
                </CardDescription>
                <div className="mt-1">
                  <Badge
                    variant={
                      member.status === "ACTIVE" ? "default" : "secondary"
                    }
                  >
                    {member.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Plano" value={member.plan?.name ?? "—"} />
              <Info
                label="Validade da carteirinha"
                value={toBrDate(validity)}
              />
              <Info label="E-mail" value={member.email} />
              <Info label="Telefone" value={member.phone} />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <FotoDialog
                currentPhotoUrl={member.photoUrl}
                initials={initials}
                trigger={
                  <Button variant="outline" size="sm">
                    <ImagePlus className="size-4" />
                    {member.photoUrl ? "Trocar foto" : "Adicionar foto"}
                  </Button>
                }
              />
              <EditarDadosDialog
                member={member}
                trigger={
                  <Button variant="outline" size="sm">
                    <Pencil className="size-4" />
                    Editar dados
                  </Button>
                }
              />
              <TrocarSenhaDialog
                trigger={
                  <Button variant="outline" size="sm">
                    <Lock className="size-4" />
                    Trocar senha
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Situação financeira */}
        <Card
          className={
            emDia ? "border-primary/30" : "border-destructive/40 bg-destructive/5"
          }
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {emDia ? (
                <CircleCheck className="size-5 text-primary" />
              ) : (
                <CircleAlert className="size-5 text-destructive" />
              )}
              Situação
            </CardTitle>
            <CardDescription>
              {emDia
                ? "Você está em dia com o clube."
                : `${pending.length} cobrança(s) em aberto · ${formatBRL(pendingTotal)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/carteirinha/${member.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <CreditCard className="size-4" />
              Ver carteirinha
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Extrato de mensalidades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-5" />
            Extrato de mensalidades
          </CardTitle>
        </CardHeader>
        <CardContent>
          {member.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma cobrança registrada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {member.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {monthName(p.referenceMonth)}/{p.referenceYear}
                    </TableCell>
                    <TableCell>{formatBRL(p.amount)}</TableCell>
                    <TableCell>{toBrDate(p.dueDate)}</TableCell>
                    <TableCell>
                      <Badge variant={PAYMENT_BADGE[p.status] ?? "secondary"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Carteirinha Física */}
      {(() => {
        const cardReq = member.physicalCardRequests[0] ?? null;
        const isPickup = cardReq?.currentStage === "awaiting_pickup";
        return (
          <Card className={isPickup ? "border-purple-500/50 bg-purple-500/5" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <IdCard className={isPickup ? "size-5 text-purple-600 dark:text-purple-400" : "size-5"} />
                Carteirinha Física
                {isPickup && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                    <Bell className="size-3" /> Pronta para retirada!
                  </span>
                )}
              </CardTitle>
              {cardReq && (
                <CardDescription>
                  {cardReq.quarter}º trimestre de {cardReq.year}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {!cardReq ? (
                <p className="text-sm text-muted-foreground">
                  Você ainda não possui uma solicitação de carteirinha física neste trimestre.
                  Caso seja elegível, entre em contato com a administração do clube.
                </p>
              ) : (
                <PhysicalCardStepper
                  currentStage={cardReq.currentStage as PhysicalCardStage}
                  requestType={cardReq.requestType ?? "PRIMEIRA_VIA"}
                  history={cardReq.statusHistory}
                />
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* LGPD — direito de acesso aos próprios dados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-5" />
            Privacidade (LGPD)
          </CardTitle>
          <CardDescription>
            Você pode baixar um registro de todas as ações associadas à sua
            conta e ao seu cadastro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="/meu-espaco/export-logs"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download className="size-4" />
            Exportar meus registros (CSV)
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

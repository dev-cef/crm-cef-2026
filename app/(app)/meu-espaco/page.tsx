import Link from "next/link";
import QRCode from "qrcode";
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
  Activity,
  CheckCircle2,
  XCircle,
  Calendar,
  MapPin,
  ChevronRight,
  Receipt,
  FileText,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { formatCpf } from "@/lib/cpf";
import { formatBRL, monthName, toBrDate } from "@/lib/format";
import { membershipNumber, membershipValidity } from "@/lib/membership";
import { buildPixPayload } from "@/lib/pix";
import { getSystemConfig } from "@/app/(app)/financeiro/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { PaymentDialog } from "@/components/modules/meu-espaco/payment-dialog";
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
import { type PhysicalCardStage, currentQuarter, checkEligibility } from "@/lib/physical-card";

export const dynamic = "force-dynamic";

const PAYMENT_BADGE: Record<string, "default" | "secondary" | "destructive"> = {
  PAGO: "default",
  PENDENTE: "secondary",
  ATRASADO: "destructive",
  AGUARDANDO_CONFIRMACAO: "secondary",
};

const PAYMENT_LABEL: Record<string, string> = {
  PAGO: "PAGO",
  PENDENTE: "PENDENTE",
  ATRASADO: "ATRASADO",
  AGUARDANDO_CONFIRMACAO: "EM ANÁLISE",
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
            include: {
              statusHistory: { orderBy: { changedAt: "asc" } },
            },
          },
          eventRegistrations: {
            include: {
              event: {
                select: { id: true, name: true, dateTime: true, status: true, eventCategory: true, location: true, difficulty: true },
              },
            },
            orderBy: { event: { dateTime: "desc" } },
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

  type PaymentRow = (typeof member.payments)[number];

  const initials = member.fullName
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const validity = member.cardValidUntil ?? membershipValidity();
  const unpaid = member.payments.filter(
    (p) =>
      p.status === "PENDENTE" ||
      p.status === "ATRASADO" ||
      p.status === "AGUARDANDO_CONFIRMACAO",
  );
  const emDia = unpaid.length === 0;
  const unpaidTotal = unpaid.reduce((s, p) => s + p.amount, 0);
  const awaitingReviewCount = unpaid.filter((p) => p.status === "AGUARDANDO_CONFIRMACAO").length;
  const nextCharge = unpaid
    .slice()
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0];
  const eligibility = checkEligibility(member.createdAt, member.eventRegistrations);

  const billingCfg = await getSystemConfig();
  const paymentDialogData = new Map<
    string,
    { qrDataUrl: string | null; pixPayload: string | null }
  >();
  await Promise.all(
    unpaid.map(async (p) => {
      if (!billingCfg.pixKey) {
        paymentDialogData.set(p.id, { qrDataUrl: null, pixPayload: null });
        return;
      }
      const pixPayload = buildPixPayload({
        key: billingCfg.pixKey,
        merchantName: billingCfg.accountHolderName || "Clube Excursionista de Friburgo",
        merchantCity: billingCfg.pixCity || "Nova Friburgo",
        amount: p.amount,
        txid: p.id,
        description: `CEF ${monthName(p.referenceMonth)}/${p.referenceYear}`,
      });
      const qrDataUrl = await QRCode.toDataURL(pixPayload, { margin: 1, width: 220 });
      paymentDialogData.set(p.id, { qrDataUrl, pixPayload });
    }),
  );

  function renderPaymentDialog(p: PaymentRow, trigger: React.ReactElement) {
    const data = paymentDialogData.get(p.id) ?? { qrDataUrl: null, pixPayload: null };
    const asaasValid =
      p.asaasPixPayload && p.asaasPixQrCode && p.asaasPixExpiresAt && p.asaasPixExpiresAt.getTime() > Date.now();
    return (
      <PaymentDialog
        trigger={trigger}
        paymentId={p.id}
        amount={p.amount}
        referenceLabel={`${monthName(p.referenceMonth)}/${p.referenceYear}`}
        dueDateLabel={toBrDate(p.dueDate)}
        status={p.status}
        receiptSubmittedAtLabel={p.receiptSubmittedAt ? toBrDate(p.receiptSubmittedAt) : null}
        billingMode={(billingCfg.billingMode as "MANUAL" | "ASAAS") ?? "MANUAL"}
        initialAsaas={
          asaasValid
            ? {
                pixPayload: p.asaasPixPayload!,
                qrDataUrl: p.asaasPixQrCode!,
                expiresAt: p.asaasPixExpiresAt!.toISOString(),
              }
            : null
        }
        pixKey={billingCfg.pixKey}
        pixKeyType={billingCfg.pixKeyType}
        pixPayload={data.pixPayload}
        qrDataUrl={data.qrDataUrl}
        bankName={billingCfg.bankName}
        bankAgency={billingCfg.bankAgency}
        bankAccount={billingCfg.bankAccount}
        accountHolderName={billingCfg.accountHolderName}
      />
    );
  }

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
                : `${unpaid.length} cobrança(s) em aberto · ${formatBRL(unpaidTotal)}${
                    awaitingReviewCount > 0
                      ? ` (${awaitingReviewCount} em análise)`
                      : ""
                  }`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {nextCharge &&
              renderPaymentDialog(
                nextCharge,
                <Button variant="outline" size="sm">
                  <Receipt className="size-4" />
                  Ver cobrança
                </Button>,
              )}
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
                  <TableHead className="text-right">Ações</TableHead>
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
                        {PAYMENT_LABEL[p.status] ?? p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(p.status === "PENDENTE" ||
                        p.status === "ATRASADO" ||
                        p.status === "AGUARDANDO_CONFIRMACAO") &&
                        renderPaymentDialog(
                          p,
                          <Button variant="ghost" size="sm">
                            <Receipt className="size-3.5" />
                            {p.status === "AGUARDANDO_CONFIRMACAO" ? "Ver status" : "Pagar"}
                          </Button>,
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Minhas Atividades */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-5" />
              Minhas Atividades
            </CardTitle>
            <Link
              href="/eventos"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Ver todos os eventos
            </Link>
          </div>
          <CardDescription>
            Exigências mínimas para emissão da carteirinha física
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Critério 1 — tempo de associação */}
          <div className="flex items-start gap-3 rounded-lg border p-3">
            {eligibility.criterion1.met ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">Sócio há mais de 3 meses</p>
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const months = eligibility.criterion1.monthsAsOf;
                  const years = Math.floor(months / 12);
                  return years < 1 ? "menos de 1 ano" : `${years} ${years === 1 ? "ano" : "anos"}`;
                })()} de associação
                {!eligibility.criterion1.met && (
                  <span className="ml-1 text-destructive">
                    · faltam {3 - eligibility.criterion1.monthsAsOf} mês(es)
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Critério 2 — participações */}
          <div className="flex items-start gap-3 rounded-lg border p-3">
            {eligibility.criterion2.met ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
            ) : (
              <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">2 reuniões sociais + 2 atividades</p>
              <p className="text-xs text-muted-foreground mb-2">
                Trilha, escalada e/ou ciclismo em eventos realizados
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted px-3 py-2 text-center">
                  <p className="text-lg font-bold tabular-nums">
                    {eligibility.criterion2.meetings}
                    <span className="text-sm font-normal text-muted-foreground">/2</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Reuniões</p>
                </div>
                <div className="rounded-md bg-muted px-3 py-2 text-center">
                  <p className="text-lg font-bold tabular-nums">
                    {eligibility.criterion2.activities}
                    <span className="text-sm font-normal text-muted-foreground">/2</span>
                  </p>
                  <p className="text-xs text-muted-foreground">Atividades</p>
                </div>
              </div>
            </div>
          </div>

          {eligibility.isEligible && (
            <p className="text-xs font-medium text-primary">
              ✓ Você atende às exigências mínimas para solicitação da carteirinha física.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Meus Eventos */}
      {(() => {
        const now = new Date();
        const upcoming = member.eventRegistrations
          .filter((r) => r.event.status !== "CANCELADO" && new Date(r.event.dateTime) >= now)
          .sort((a, b) => new Date(a.event.dateTime).getTime() - new Date(b.event.dateTime).getTime());
        const past = member.eventRegistrations
          .filter((r) => r.event.status === "REALIZADO")
          .slice(0, 5);

        const DIFFICULTY_LABEL: Record<string, string> = {
          FACIL: "Fácil", MODERADO: "Moderado", DIFICIL: "Difícil", TECNICO: "Técnico",
        };
        const DIFFICULTY_COLOR: Record<string, string> = {
          FACIL: "text-green-600 dark:text-green-400",
          MODERADO: "text-yellow-600 dark:text-yellow-400",
          DIFICIL: "text-orange-600 dark:text-orange-400",
          TECNICO: "text-red-600 dark:text-red-400",
        };
        const STATUS_LABEL: Record<string, string> = {
          PLANEJADO: "Planejado", CONFIRMADO: "Confirmado", REALIZADO: "Realizado", CANCELADO: "Cancelado",
        };

        return (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="size-5" />
                  Meus Eventos
                </CardTitle>
                <Link href="/eventos" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Ver todos <ChevronRight className="size-3.5" />
                </Link>
              </div>
              <CardDescription>
                Eventos em que você está inscrito
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcoming.length === 0 && past.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Você ainda não está inscrito em nenhum evento.
                </p>
              )}

              {upcoming.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximos</p>
                  <div className="divide-y rounded-lg border">
                    {upcoming.map((r) => (
                      <Link
                        key={r.event.id}
                        href={`/eventos/${r.event.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{r.event.name}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarClock className="size-3" />
                              {toBrDate(r.event.dateTime)}
                            </span>
                            {r.event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3" />
                                {r.event.location}
                              </span>
                            )}
                            {r.event.difficulty && (
                              <span className={DIFFICULTY_COLOR[r.event.difficulty] ?? ""}>
                                {DIFFICULTY_LABEL[r.event.difficulty] ?? r.event.difficulty}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {STATUS_LABEL[r.event.status] ?? r.event.status}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {past.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Realizados recentemente</p>
                  <div className="divide-y rounded-lg border">
                    {past.map((r) => (
                      <Link
                        key={r.event.id}
                        href={`/eventos/${r.event.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-muted-foreground">{r.event.name}</p>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarClock className="size-3" />
                            {toBrDate(r.event.dateTime)}
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0 bg-muted text-[10px] text-muted-foreground">
                          Realizado
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Carteirinha Física */}
      {(() => {
        const { quarter, year } = currentQuarter();
        const requests = member.physicalCardRequests.filter(
          (r) => r.quarter === quarter && r.year === year,
        );
        const hasPickup = requests.some((r) => r.currentStage === "awaiting_pickup");

        if (requests.length === 0) {
          return (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <IdCard className="size-5" />
                  Carteirinha Física
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Você ainda não possui uma solicitação de carteirinha física neste trimestre.
                  Caso seja elegível, entre em contato com a administração do clube.
                </p>
              </CardContent>
            </Card>
          );
        }

        return (
          <div className="space-y-4">
            {requests.map((cardReq) => {
              const requestType = cardReq.requestType ?? "PRIMEIRA_VIA";
              const isSecondCopy = requestType === "SEGUNDA_VIA";
              const isPickup = cardReq.currentStage === "awaiting_pickup";
              const isPaymentPending = cardReq.currentStage === "payment_pending";

              return (
                <Card
                  key={cardReq.id}
                  className={
                    isPickup
                      ? "border-purple-500/50 bg-purple-500/5"
                      : isPaymentPending
                        ? "border-orange-500/40 bg-orange-500/5"
                        : undefined
                  }
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <IdCard
                        className={
                          isPickup
                            ? "size-5 text-purple-600 dark:text-purple-400"
                            : isPaymentPending
                              ? "size-5 text-orange-600 dark:text-orange-400"
                              : "size-5"
                        }
                      />
                      Carteirinha Física
                      <span className="text-xs font-normal text-muted-foreground">
                        {isSecondCopy ? "· 2ª via" : "· 1ª via"}
                      </span>
                      {isPickup && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                          <Bell className="size-3" /> Pronta para retirada!
                        </span>
                      )}
                      {isPaymentPending && (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-300">
                          <CreditCard className="size-3" /> Pagamento pendente
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {cardReq.quarter}º trimestre de {cardReq.year}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isPaymentPending && (
                      <div className="rounded-md border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-700 dark:text-orange-300">
                        <p className="font-medium">Taxa de 2ª via: R$ 30,00</p>
                        <p className="text-xs opacity-80 mt-0.5">
                          Aguardando confirmação do pagamento pela administração.
                        </p>
                      </div>
                    )}
                    <PhysicalCardStepper
                      currentStage={cardReq.currentStage as PhysicalCardStage}
                      requestType={requestType}
                      history={cardReq.statusHistory}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* Documentos oficiais do clube */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-5" />
            Documentos do CEF
          </CardTitle>
          <CardDescription>
            Estatuto, regimento interno, regras do grupo, comunicados e outros
            documentos oficiais do clube.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/meu-espaco/documentos"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <FileText className="size-4" />
            Ver documentos
            <ChevronRight className="size-4" />
          </Link>
        </CardContent>
      </Card>

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

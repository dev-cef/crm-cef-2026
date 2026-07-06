import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  MessageCircle,
  PackageCheck,
  Printer,
  CreditCard,
  Download,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { membershipNumber } from "@/lib/membership";
import { cn } from "@/lib/utils";
import {
  STAGE_LABELS,
  type PhysicalCardStage,
  type EligibilitySnapshot,
} from "@/lib/physical-card";
import { approveRequest, markAsReadyForPickup, confirmPayment } from "../actions";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PhysicalCardStepper } from "@/components/modules/carteirinha/physical-card-stepper";
import { RejectDialog } from "@/components/modules/carteirinha/reject-dialog";
import { DeliverDialog } from "@/components/modules/carteirinha/deliver-dialog";
import { BatchIssueDialog } from "@/components/modules/carteirinha/batch-issue-dialog";

export const dynamic = "force-dynamic";

export default async function FisicaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const request = await prisma.physicalCardRequest.findUnique({
    where: { id },
    include: {
      member: {
        select: {
          fullName: true,
          registration: true,
          photoUrl: true,
          phone: true,
          whatsapp: true,
          createdAt: true,
          plan: { select: { name: true } },
        },
      },
      statusHistory: {
        orderBy: { changedAt: "asc" },
      },
    },
  });

  if (!request) notFound();

  const member = request.member;
  const stage = request.currentStage as PhysicalCardStage;
  const requestType = request.requestType ?? "PRIMEIRA_VIA";
  const isSecondCopy = requestType === "SEGUNDA_VIA";
  const eligibility = JSON.parse(request.eligibilitySnapshot) as EligibilitySnapshot & { secondCopy?: boolean };

  const initials = member.fullName
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // WhatsApp link para notificação (Etapa 04)
  const phone = member.whatsapp ?? member.phone;
  const waMsg = encodeURIComponent(
    `Olá, ${member.fullName}! Sua carteirinha física do CEF está disponível para retirada na sede.`,
  );
  const whatsappHref = phone
    ? `https://wa.me/55${phone.replace(/\D/g, "")}?text=${waMsg}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/carteirinha/fisica">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        </Link>
        <PageHeader
          title={`Carteirinha de ${member.fullName}`}
          description={`${membershipNumber(member.registration)} · ${request.quarter}º tri/${request.year}${isSecondCopy ? " · 2ª via" : ""}`}
        />
      </div>

      {/* Stepper */}
      <Card>
        <CardContent className="pt-6">
          <PhysicalCardStepper
            currentStage={stage}
            requestType={requestType}
            history={request.statusHistory.map((h) => ({
              toStage: h.toStage,
              changedAt: h.changedAt,
              changedBy: h.changedBy,
            }))}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Dados do sócio */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do sócio</CardTitle>
          </CardHeader>
          <CardContent className="flex items-start gap-4">
            <Avatar className="size-16 shrink-0">
              {member.photoUrl && (
                <AvatarImage src={member.photoUrl} alt={member.fullName} />
              )}
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1 text-sm">
              <p className="font-semibold">{member.fullName}</p>
              <p className="text-muted-foreground">
                {membershipNumber(member.registration)}
              </p>
              <p className="text-muted-foreground">
                Sócio desde:{" "}
                {new Date(member.createdAt).toLocaleDateString("pt-BR")}
              </p>
              {member.plan && (
                <p className="text-muted-foreground">
                  Plano: {member.plan.name}
                </p>
              )}
              {member.photoUrl && (
                <a
                  href={`/api/associados/${request.memberId}/foto`}
                  download
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-1")}
                >
                  <Download className="size-4" />
                  Baixar foto
                </a>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Checklist de elegibilidade — apenas 1ª via */}
        {isSecondCopy ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2ª via</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-muted-foreground" />
                <span>Taxa de emissão: <strong>R$ 30,00</strong></span>
              </div>
              {request.paymentPaidAt && (
                <p className="text-xs text-muted-foreground">
                  Pago em {new Date(request.paymentPaidAt).toLocaleDateString("pt-BR")}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Checklist de elegibilidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {/* Critério 1 */}
              <div className="flex items-start gap-2">
                {eligibility.criterion1?.met ? (
                  <CheckCircle className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <div>
                  <p className="font-medium">Sócio há mais de 3 meses</p>
                  <p className="text-muted-foreground">
                    {(() => {
                      const months = eligibility.criterion1?.monthsAsOf ?? 0;
                      const years = Math.floor(months / 12);
                      return years < 1 ? "menos de 1 ano" : `${years} ${years === 1 ? "ano" : "anos"}`;
                    })()} de associação
                    {!eligibility.criterion1?.met && (
                      <span className="ml-1 text-destructive">
                        (faltam {3 - (eligibility.criterion1?.monthsAsOf ?? 0)} meses)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Critério 2 */}
              <div className="flex items-start gap-2">
                {eligibility.criterion2?.met ? (
                  <CheckCircle className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <div>
                  <p className="font-medium">2 reuniões + 2 atividades realizadas</p>
                  <p className="text-muted-foreground">
                    {eligibility.criterion2?.meetings ?? 0} reunião(ões)
                    {(eligibility.criterion2?.meetings ?? 0) < 2 && (
                      <span className="ml-1 text-destructive">
                        (falta {2 - (eligibility.criterion2?.meetings ?? 0)})
                      </span>
                    )}
                    {" · "}
                    {eligibility.criterion2?.activities ?? 0} atividade(s)
                    {(eligibility.criterion2?.activities ?? 0) < 2 && (
                      <span className="ml-1 text-destructive">
                        (falta {2 - (eligibility.criterion2?.activities ?? 0)})
                      </span>
                    )}
                  </p>
                  {(eligibility.criterion2?.meetingDetails?.length ?? 0) > 0 && (
                    <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                      {eligibility.criterion2.meetingDetails.map((m, i) => (
                        <li key={i}>
                          {m.name} — {new Date(m.date).toLocaleDateString("pt-BR")}
                        </li>
                      ))}
                      {eligibility.criterion2.activityDetails.map((a, i) => (
                        <li key={`a${i}`}>
                          {a.name} — {new Date(a.date).toLocaleDateString("pt-BR")}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Ações contextuais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {stage === "payment_pending" && (
            <form
              action={async () => {
                "use server";
                await confirmPayment(id);
              }}
            >
              <Button type="submit">
                <CreditCard className="size-4" />
                Confirmar pagamento R$ 30,00
              </Button>
            </form>
          )}

          {stage === "minimum_requirements" && (
            <>
              <form
                action={async () => {
                  "use server";
                  await approveRequest(id);
                }}
              >
                <Button type="submit">
                  <CheckCircle className="size-4" />
                  Aprovar
                </Button>
              </form>
              <RejectDialog
                requestId={id}
                trigger={
                  <Button variant="destructive">
                    <XCircle className="size-4" />
                    Reprovar
                  </Button>
                }
              />
            </>
          )}

          {stage === "issuance_pending" && (
            <BatchIssueDialog
              requestIds={[id]}
              memberNames={[member.fullName]}
              trigger={
                <Button>
                  <Printer className="size-4" />
                  Marcar como emitida
                </Button>
              }
            />
          )}

          {stage === "in_production" && (
            <>
              <form
                action={async () => {
                  "use server";
                  await markAsReadyForPickup(id);
                }}
              >
                <Button type="submit">
                  <Clock className="size-4" />
                  Marcar aguardando retirada
                </Button>
              </form>
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">
                    <MessageCircle className="size-4" />
                    Notificar via WhatsApp
                  </Button>
                </a>
              )}
            </>
          )}

          {stage === "awaiting_pickup" && (
            <>
              <DeliverDialog
                requestId={id}
                memberName={member.fullName}
                trigger={
                  <Button>
                    <PackageCheck className="size-4" />
                    Marcar como entregue
                  </Button>
                }
              />
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline">
                    <MessageCircle className="size-4" />
                    Notificar via WhatsApp
                  </Button>
                </a>
              )}
            </>
          )}

          {stage === "rejected" && request.rejectedReason && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3">
              <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">Reprovada</p>
                <p className="text-sm text-muted-foreground">
                  {request.rejectedReason}
                </p>
              </div>
            </div>
          )}

          {stage === "delivered" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="size-4 text-primary" />
              Entregue em{" "}
              {request.deliveredAt
                ? new Date(request.deliveredAt).toLocaleDateString("pt-BR")
                : "—"}
              {request.receivedBy && ` · Retirado por: ${request.receivedBy}`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative border-l border-border pl-6">
            {[...request.statusHistory].reverse().map((h, i) => (
              <li key={h.id} className={cn("mb-4", i === 0 && "font-medium")}>
                <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-background bg-primary" />
                <time className="text-xs text-muted-foreground">
                  {new Date(h.changedAt).toLocaleString("pt-BR")}
                </time>
                <p className="text-sm">
                  {STAGE_LABELS[h.toStage as PhysicalCardStage] ?? h.toStage}{" "}
                  <span className="text-muted-foreground">por {h.changedBy}</span>
                </p>
                {h.payload && (() => {
                  try {
                    const p = JSON.parse(h.payload) as Record<string, unknown>;
                    const note = p.notes ?? p.reason ?? p.deliveredAt;
                    return note ? (
                      <p className="text-xs text-muted-foreground">{String(note)}</p>
                    ) : null;
                  } catch { return null; }
                })()}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

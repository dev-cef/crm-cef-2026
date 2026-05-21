import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  HeartPulse,
  LogOut,
  Mountain,
  Pencil,
  Phone,
  Trash2,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { scopedMemberWhere, toSessionUser } from "@/lib/rbac";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { formatCpf } from "@/lib/cpf";
import {
  calculateAge,
  formatBRL,
  formatDate,
  monthName,
  toBrDate,
} from "@/lib/format";
import {
  BLOOD_TYPE_LABELS,
  MOUNTAIN_EXPERIENCE,
  INTEREST_FIELDS,
  labelFrom,
  SEX_OPTIONS,
} from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { DeleteMemberDialog } from "@/components/modules/associados/delete-member-dialog";
import { FamilyPlanCard } from "@/components/modules/associados/family-plan-card";
import { MemberSinceDialog } from "@/components/modules/associados/member-since-dialog";
import { PaymentReciboButton } from "@/components/modules/associados/payment-recibo-button";
import { ChangePasswordDialog } from "@/components/modules/associados/change-password-dialog";

export const dynamic = "force-dynamic";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

const PAYMENT_BADGE: Record<string, "default" | "secondary" | "destructive"> = {
  PAGO: "default",
  PENDENTE: "secondary",
  ATRASADO: "destructive",
};

export default async function AssociadoPerfilPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("DEPARTAMENTO");
  const { id } = await params;

  const session = await auth();
  const sessionUser = toSessionUser(session!.user);
  const [canEdit, canDelete] = await Promise.all([
    can(sessionUser, "associados", "edit"),
    can(sessionUser, "associados", "delete"),
  ]);
  const isAdminUser = sessionUser.role === "ADMIN";

  const member = await prisma.member.findFirst({
    where: { id, deletedAt: null, ...scopedMemberWhere(user) },
    include: {
      plan: true,
      payments: { orderBy: [{ referenceYear: "desc" }, { referenceMonth: "desc" }] },
      physicalCardRequests: { orderBy: { createdAt: "desc" } },
      titular: { select: { id: true, fullName: true, registration: true, photoUrl: true, phone: true, plan: { select: { name: true } } } },
      dependente: { select: { id: true, fullName: true, registration: true, photoUrl: true, phone: true, plan: { select: { name: true } } } },
    },
  });

  if (!member) notFound();

  let conditions: string[] = [];
  try {
    conditions = JSON.parse(member.healthConditions) as string[];
  } catch {
    conditions = [];
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/associados"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-3",
        )}
      >
        <ArrowLeft className="size-4" /> Voltar para a lista
      </Link>

      <PageHeader title={member.fullName} description={`Matrícula #${member.registration}`}>
        {canEdit && (
          <Link
            href={`/associados/${member.id}/editar`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Pencil className="size-4" /> Editar
          </Link>
        )}
        {isAdminUser && (
          <ChangePasswordDialog memberId={member.id} memberName={member.fullName} />
        )}
        {canDelete && (
          <DeleteMemberDialog
            id={member.id}
            name={member.fullName}
            redirectTo="/associados"
            trigger={
              <Button variant="destructive" size="sm">
                <Trash2 className="size-4" /> Desativar
              </Button>
            }
          />
        )}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <Avatar className="size-24">
              {member.photoUrl && (
                <AvatarImage src={member.photoUrl} alt={member.fullName} />
              )}
              <AvatarFallback className="text-xl">
                {member.fullName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{member.fullName}</p>
              <p className="text-sm text-muted-foreground">
                {calculateAge(member.birthDate)} anos
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Badge variant={member.status === "ACTIVE" ? "default" : "secondary"}>
                {member.status === "ACTIVE" ? "Ativo" : "Inativo"}
              </Badge>
              {member.plan && <Badge variant="secondary">{member.plan.name}</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Informações pessoais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="CPF" value={formatCpf(member.cpf)} />
            <Info
              label="Sexo"
              value={labelFrom(SEX_OPTIONS, member.sex)}
            />
            <Info label="E-mail" value={member.email} />
            <Info label="Telefone" value={member.phone} />
            <Info
              label="Nascimento"
              value={`${toBrDate(member.birthDate)}`}
            />
            <div>
              <p className="text-xs text-muted-foreground">Associado desde</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium">
                  {(() => {
                    const years = calculateAge(member.createdAt);
                    const suffix = years === 0 ? "menos de 1 ano" : years === 1 ? "1 ano" : `${years} anos`;
                    return `${toBrDate(member.createdAt)} (${suffix})`;
                  })()}
                </p>
                {isAdminUser && (
                  <MemberSinceDialog
                    memberId={member.id}
                    current={toBrDate(member.createdAt)}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Endereço</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Info label="CEP" value={member.cep} />
            <Info
              label="Logradouro"
              value={`${member.street}, ${member.number}${
                member.complement ? ` — ${member.complement}` : ""
              }`}
            />
            <Info label="Bairro" value={member.neighborhood} />
            <Info label="Cidade" value={member.city} />
            <Info label="Estado" value={member.state} />
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="size-4" /> Saúde e emergência
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Info
              label="Tipo sanguíneo"
              value={BLOOD_TYPE_LABELS[member.bloodType] ?? member.bloodType}
            />
            <Info label="Contato de emergência" value={member.emergencyName} />
            <Info
              label="Telefone de emergência"
              value={
                <span className="flex items-center gap-1">
                  <Phone className="size-3" /> {member.emergencyPhone}
                </span>
              }
            />
            <div className="sm:col-span-3">
              <p className="text-xs text-muted-foreground">Condições de saúde</p>
              {conditions.length === 0 ? (
                <p className="text-sm">Nenhuma informada</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1">
                  {conditions.map((c) => (
                    <Badge key={c} variant="secondary">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
              {member.healthDetails && (
                <p className="mt-2 text-sm">{member.healthDetails}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mountain className="size-4" /> Experiência e interesses
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info
              label="Experiência em montanha"
              value={labelFrom(
                MOUNTAIN_EXPERIENCE.map((o) => ({ ...o })),
                member.mountainExperience,
              )}
            />
            <Info
              label="Outro grupo/clube"
              value={
                member.otherGroup
                  ? member.otherGroupName || "Sim"
                  : "Não"
              }
            />
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs text-muted-foreground">
                Escala de interesse (1–5)
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {INTEREST_FIELDS.map((f) => {
                  const v = member[
                    f.key as keyof typeof member
                  ] as number;
                  return (
                    <div
                      key={f.key}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span>{f.label}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span
                            key={n}
                            className={cn(
                              "size-4 rounded-sm",
                              n <= v ? "bg-primary" : "bg-muted",
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {member.suggestions && (
              <div className="sm:col-span-2">
                <Info label="Sugestões" value={member.suggestions} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Motivo de desligamento (apenas quando inativo) */}
        {member.status === "INACTIVE" && (member.inactiveReason || member.inactiveAt) && (
          <Card className="md:col-span-3 border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <LogOut className="size-4" /> Desligamento
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {member.inactiveAt && (
                <Info label="Data de saída" value={toBrDate(member.inactiveAt)} />
              )}
              {member.inactiveReason && (
                <div className="sm:col-span-2">
                  <Info label="Motivo do desligamento" value={member.inactiveReason} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Plano Família */}
        {member.plan?.name.includes("Família") && (
          <FamilyPlanCard
            memberId={member.id}
            planName={member.plan.name}
            role={member.titularId ? "dependente" : "titular"}
            linked={member.titularId ? member.titular : member.dependente}
          />
        )}

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4" /> Histórico de pagamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {member.payments.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                Nenhum pagamento registrado.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referência</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {member.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.notes === "Taxa de inscrição" ? (
                          <Badge variant="outline" className="border-blue-500/50 text-blue-600 dark:text-blue-400">
                            Inscrição
                          </Badge>
                        ) : (
                          <span className="text-sm">{monthName(p.referenceMonth)}/{p.referenceYear}</span>
                        )}
                      </TableCell>
                      <TableCell>{formatBRL(p.amount)}</TableCell>
                      <TableCell>{formatDate(p.dueDate)}</TableCell>
                      <TableCell>
                        {p.paidAt ? formatDate(p.paidAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PAYMENT_BADGE[p.status] ?? "secondary"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <PaymentReciboButton
                          paymentId={p.id}
                          memberName={member.fullName}
                          memberCpf={member.cpf}
                          planName={member.plan?.name ?? "—"}
                          amount={p.amount}
                          dueDate={p.dueDate.toISOString()}
                          paidAt={p.paidAt?.toISOString() ?? null}
                          receiptNumber={p.receiptNumber ?? null}
                          notes={p.notes ?? null}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {/* Histórico de carteirinhas físicas */}
        {isAdminUser && member.physicalCardRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                Carteirinhas Físicas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trimestre</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Entregue em</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {member.physicalCardRequests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.quarter}º tri/{r.year}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {r.currentStage.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.deliveredAt
                          ? new Date(r.deliveredAt).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Link href={`/carteirinha/fisica/${r.id}`}>
                          <Button variant="ghost" size="sm">Ver</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

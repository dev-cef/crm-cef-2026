import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatDate, monthName } from "@/lib/format";
import { formatCpf } from "@/lib/cpf";
import { PrintButton } from "@/components/modules/financeiro/print-button";

export const dynamic = "force-dynamic";

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      member: {
        select: {
          fullName: true,
          cpf: true,
          registration: true,
          email: true,
          phone: true,
          city: true,
          state: true,
        },
      },
      plan: { select: { name: true, billingPeriod: true } },
    },
  });

  if (!payment) notFound();

  const member = payment.member;
  const plan = payment.plan;
  const receiptNum = `${payment.referenceYear}${String(payment.referenceMonth).padStart(2, "0")}-${payment.id.slice(-6).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-background p-8 print:p-0">
      {/* Toolbar (hidden on print) */}
      <div className="mb-6 flex items-center gap-3 print:hidden">
        <PrintButton />
      </div>

      {/* Recibo */}
      <div className="mx-auto max-w-2xl rounded-xl border bg-card p-8 shadow-sm print:rounded-none print:border-none print:shadow-none">
        {/* Cabeçalho */}
        <div className="mb-6 flex items-start justify-between border-b pb-6">
          <div>
            <p className="font-display text-xl font-semibold">Clube Excursionista de Friburgo</p>
            <p className="text-sm text-muted-foreground">CNPJ 00.000.000/0000-00</p>
            <p className="text-sm text-muted-foreground">Nova Friburgo — RJ</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Recibo nº</p>
            <p className="font-mono text-sm font-semibold">{receiptNum}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Emitido em {formatDate(new Date())}
            </p>
          </div>
        </div>

        {/* Título */}
        <h1 className="mb-6 text-center text-lg font-semibold uppercase tracking-wide">
          Recibo de Pagamento de Mensalidade
        </h1>

        {/* Dados do associado */}
        <div className="mb-6 rounded-lg bg-muted/40 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Dados do Associado
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Nome completo</p>
              <p className="font-medium">{member.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Matrícula</p>
              <p className="font-medium">#{member.registration}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CPF</p>
              <p className="font-medium">{formatCpf(member.cpf)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Plano</p>
              <p className="font-medium">{plan?.name ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* Detalhes do pagamento */}
        <div className="mb-6 rounded-lg bg-muted/40 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Detalhes do Pagamento
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Referência</p>
              <p className="font-medium">
                {monthName(payment.referenceMonth)} / {payment.referenceYear}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencimento</p>
              <p className="font-medium">{formatDate(payment.dueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-medium">
                {payment.status === "PAGO"
                  ? "Pago"
                  : payment.status === "PENDENTE"
                  ? "Pendente"
                  : "Atrasado"}
              </p>
            </div>
            {payment.paidAt && (
              <div>
                <p className="text-xs text-muted-foreground">Pago em</p>
                <p className="font-medium">{formatDate(payment.paidAt)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Valor */}
        <div className="mb-8 flex items-center justify-between rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
          <p className="font-semibold">Valor pago</p>
          <p className="font-display text-2xl font-bold">{formatBRL(payment.amount)}</p>
        </div>

        {/* Assinaturas */}
        <div className="mt-12 grid grid-cols-2 gap-8">
          <div className="text-center">
            <div className="mb-1 border-t border-foreground/40" />
            <p className="text-xs text-muted-foreground">Assinatura do Associado</p>
          </div>
          <div className="text-center">
            <div className="mb-1 border-t border-foreground/40" />
            <p className="text-xs text-muted-foreground">Tesoureiro — CEF</p>
          </div>
        </div>

        {/* Rodapé */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Clube Excursionista de Friburgo · Nova Friburgo/RJ · Documento gerado em{" "}
          {new Date().toLocaleString("pt-BR")}
        </p>
      </div>
    </div>
  );
}

import { Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBRL, formatDateTime, monthName } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import {
  ComprovanteReviewCard,
  type PaymentOption,
} from "@/components/modules/financeiro/comprovante-review-card";

export const dynamic = "force-dynamic";

const MOTIVO_LABEL: Record<string, string> = {
  socio_nao_identificado: "Sócio não identificado",
  extracao_indisponivel: "Leitura automática indisponível",
  nao_e_comprovante: "Não parece um comprovante",
  baixa_confianca: "Imagem ilegível",
  sem_pendencia: "Sem mensalidade em aberto",
  valor_divergente: "Valor divergente",
  multiplas_pendencias: "Mais de uma pendência compatível",
  comprovante_duplicado: "Imagem já utilizada",
  transacao_duplicada: "Transação já utilizada",
};

export default async function ComprovantesPage() {
  const [pendentes, cobrancas] = await Promise.all([
    prisma.whatsappComprovante.findMany({
      where: { status: "AGUARDANDO_REVISAO" },
      orderBy: { createdAt: "asc" },
      include: { member: { select: { id: true, fullName: true } } },
    }),
    prisma.payment.findMany({
      where: { status: { in: ["PENDENTE", "ATRASADO", "AGUARDANDO_CONFIRMACAO"] } },
      include: { member: { select: { id: true, fullName: true } } },
      orderBy: [{ member: { fullName: "asc" } }, { referenceYear: "asc" }, { referenceMonth: "asc" }],
    }),
  ]);

  const options: (PaymentOption & { memberId: string; amount: number })[] = cobrancas.map((p) => ({
    id: p.id,
    memberId: p.member.id,
    amount: p.amount,
    label: `${p.member.fullName} — ${monthName(p.referenceMonth)}/${p.referenceYear} — ${formatBRL(p.amount)}`,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comprovantes (WhatsApp)"
        description="Comprovantes enviados ao WhatsApp do clube que precisam de revisão manual."
      />

      {pendentes.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed py-16 text-muted-foreground">
          <Inbox className="size-8" />
          <p className="text-sm">Nenhum comprovante aguardando revisão. 🎉</p>
        </div>
      )}

      <div className="space-y-4">
        {pendentes.map((c) => {
          // Sugestão: pendência do próprio sócio com o valor lido pela IA.
          const doSocio = c.memberId ? options.filter((o) => o.memberId === c.memberId) : [];
          const sugestao =
            c.valor != null
              ? (doSocio.find((o) => Math.abs(o.amount - c.valor!) < 0.005) ?? doSocio[0] ?? null)
              : (doSocio[0] ?? null);
          return (
            <ComprovanteReviewCard
              key={c.id}
              id={c.id}
              imageDataUri={c.imageDataUri}
              senderLabel={`${c.pushName ?? "Desconhecido"} · ${c.senderPhone}`}
              memberName={c.member?.fullName ?? null}
              motivoLabel={MOTIVO_LABEL[c.motivoRevisao ?? ""] ?? c.motivoRevisao ?? "Revisão"}
              extracao={{
                valor: c.valor != null ? formatBRL(c.valor) : null,
                dataHora: c.dataHora,
                pagador: c.nomePagador,
                instituicao: c.instituicao,
                confianca: c.confianca != null ? `${(c.confianca * 100).toFixed(0)}%` : null,
              }}
              createdAtLabel={formatDateTime(c.createdAt)}
              paymentOptions={options}
              suggestedPaymentId={sugestao?.id ?? null}
            />
          );
        })}
      </div>
    </div>
  );
}

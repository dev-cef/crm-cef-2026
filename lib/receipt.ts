import type { Prisma } from "@/app/generated/prisma/client";

// Gera o próximo número de recibo do ano no formato YYYY-NNNN.
// DEVE rodar dentro de uma transação (tx): o count+1 depende do isolamento da
// transação para reduzir a janela de corrida entre baixas concorrentes
// (baixa manual, edição e webhook Asaas podem confirmar pagamentos em paralelo).
export async function generateReceiptNumber(
  tx: Prisma.TransactionClient,
  year: number,
): Promise<string> {
  const count = await tx.payment.count({
    where: { receiptNumber: { startsWith: `${year}-` } },
  });
  return `${year}-${String(count + 1).padStart(4, "0")}`;
}

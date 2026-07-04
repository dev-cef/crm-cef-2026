import type { Prisma } from "@/app/generated/prisma/client";

// Gera o próximo número de recibo do ano no formato YYYY-NNNN usando MAX+1
// (imune a números removidos/resetados, diferente do antigo count+1). A coluna
// receiptNumber é @unique: sob concorrência, uma das transações falha com P2002
// em vez de gravar duplicado — o chamador deve tentar de novo (ver confirmPaymentPaid).
export async function generateReceiptNumber(
  tx: Prisma.TransactionClient,
  year: number,
): Promise<string> {
  const last = await tx.payment.findFirst({
    where: { receiptNumber: { startsWith: `${year}-` } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });
  const next = last?.receiptNumber ? parseInt(last.receiptNumber.slice(5), 10) + 1 : 1;
  return `${year}-${String(next).padStart(4, "0")}`;
}

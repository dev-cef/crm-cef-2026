import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback para .env
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { persistComprovante, comprovanteBlobConfigured } from "../lib/blob";

// Migra comprovantes financeiros (base64) já gravados no banco para o Vercel
// Blob privado, substituindo o data URI pelo pathname. Idempotente: valores
// que já são pathname (não começam com "data:") são pulados.
//
// Uso:  npx tsx scripts/migrate-comprovantes-to-blob.ts
// Requer BLOB_READ_WRITE_TOKEN no ambiente (senão persistComprovante devolveria
// o próprio base64 e nada seria migrado).

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const isComprovanteDataUrl = (v: string | null | undefined): v is string =>
  typeof v === "string" && (v.startsWith("data:image/") || v.startsWith("data:application/pdf"));

async function migratePaymentReceipts() {
  const rows = await prisma.payment.findMany({ select: { id: true, receiptPath: true } });
  let n = 0;
  for (const r of rows) {
    if (!isComprovanteDataUrl(r.receiptPath)) continue;
    const pathname = await persistComprovante(r.receiptPath, "comprovantes/pagamentos");
    if (pathname && pathname !== r.receiptPath) {
      await prisma.payment.update({ where: { id: r.id }, data: { receiptPath: pathname } });
      n++;
    }
  }
  return n;
}

async function migrateWhatsappComprovantes() {
  const rows = await prisma.whatsappComprovante.findMany({ select: { id: true, imageDataUri: true } });
  let n = 0;
  for (const r of rows) {
    if (!isComprovanteDataUrl(r.imageDataUri)) continue;
    // imageSha256 não é recalculado — deve continuar estável para o dedupe,
    // já foi computado na ingestão a partir dos bytes originais.
    const pathname = await persistComprovante(r.imageDataUri, "comprovantes/whatsapp");
    if (pathname && pathname !== r.imageDataUri) {
      await prisma.whatsappComprovante.update({ where: { id: r.id }, data: { imageDataUri: pathname } });
      n++;
    }
  }
  return n;
}

async function migrateTransactionAttachments() {
  const rows = await prisma.transaction.findMany({ select: { id: true, attachmentUrl: true } });
  let n = 0;
  for (const r of rows) {
    if (!isComprovanteDataUrl(r.attachmentUrl)) continue;
    const pathname = await persistComprovante(r.attachmentUrl, "comprovantes/transacoes");
    if (pathname && pathname !== r.attachmentUrl) {
      await prisma.transaction.update({ where: { id: r.id }, data: { attachmentUrl: pathname } });
      n++;
    }
  }
  return n;
}

async function main() {
  if (!comprovanteBlobConfigured()) {
    console.error("✗ BLOB_COMPROVANTES_READ_WRITE_TOKEN ausente. Provisione o Vercel Blob antes de migrar.");
    process.exit(1);
  }
  console.log("Migrando comprovantes base64 → Vercel Blob (privado)...\n");
  const pagamentos = await migratePaymentReceipts();
  console.log(`  Pagamentos:   ${pagamentos} comprovante(s) migrado(s)`);
  const whatsapp = await migrateWhatsappComprovantes();
  console.log(`  WhatsApp:     ${whatsapp} comprovante(s) migrado(s)`);
  const transacoes = await migrateTransactionAttachments();
  console.log(`  Transações:   ${transacoes} anexo(s) migrado(s)`);
  console.log(`\n✓ Total: ${pagamentos + whatsapp + transacoes} arquivo(s) movido(s) para o Blob.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

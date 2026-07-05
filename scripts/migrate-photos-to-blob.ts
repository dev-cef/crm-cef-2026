import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { persistImage, blobConfigured } from "../lib/blob";

// Migra fotos base64 já gravadas no banco para o Vercel Blob, substituindo o
// data URI pela URL pública. Idempotente: valores que já são URL são pulados.
//
// Uso:  npx tsx scripts/migrate-photos-to-blob.ts
// Requer BLOB_READ_WRITE_TOKEN no ambiente (senão persistImage devolveria o
// próprio base64 e nada seria migrado).

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const isDataUrl = (v: string | null | undefined): v is string =>
  typeof v === "string" && v.startsWith("data:image/");

async function migrateMembers() {
  const rows = await prisma.member.findMany({ select: { id: true, photoUrl: true } });
  let n = 0;
  for (const r of rows) {
    if (!isDataUrl(r.photoUrl)) continue;
    const url = await persistImage(r.photoUrl, "associados");
    if (url && url !== r.photoUrl) {
      await prisma.member.update({ where: { id: r.id }, data: { photoUrl: url } });
      n++;
    }
  }
  return n;
}

async function migrateEventPhotos() {
  const rows = await prisma.eventPhoto.findMany({ select: { id: true, eventId: true, url: true } });
  let n = 0;
  for (const r of rows) {
    if (!isDataUrl(r.url)) continue;
    const url = await persistImage(r.url, `eventos/${r.eventId}`);
    if (url && url !== r.url) {
      await prisma.eventPhoto.update({ where: { id: r.id }, data: { url } });
      n++;
    }
  }
  return n;
}

async function migratePatrimonio() {
  const rows = await prisma.patrimonioBem.findMany({ select: { id: true, fotoUrl: true } });
  let n = 0;
  for (const r of rows) {
    if (!isDataUrl(r.fotoUrl)) continue;
    const url = await persistImage(r.fotoUrl, "patrimonio");
    if (url && url !== r.fotoUrl) {
      await prisma.patrimonioBem.update({ where: { id: r.id }, data: { fotoUrl: url } });
      n++;
    }
  }
  return n;
}

async function migrateBiblioteca() {
  const rows = await prisma.bibliotecaLivro.findMany({ select: { id: true, capaUrl: true } });
  let n = 0;
  for (const r of rows) {
    if (!isDataUrl(r.capaUrl)) continue;
    const url = await persistImage(r.capaUrl, "biblioteca");
    if (url && url !== r.capaUrl) {
      await prisma.bibliotecaLivro.update({ where: { id: r.id }, data: { capaUrl: url } });
      n++;
    }
  }
  return n;
}

async function main() {
  if (!blobConfigured()) {
    console.error("✗ BLOB_READ_WRITE_TOKEN ausente. Provisione o Vercel Blob antes de migrar.");
    process.exit(1);
  }
  console.log("Migrando fotos base64 → Vercel Blob...\n");
  const members = await migrateMembers();
  console.log(`  Associados:  ${members} foto(s) migrada(s)`);
  const events = await migrateEventPhotos();
  console.log(`  Eventos:     ${events} foto(s) migrada(s)`);
  const bens = await migratePatrimonio();
  console.log(`  Patrimônio:  ${bens} foto(s) migrada(s)`);
  const livros = await migrateBiblioteca();
  console.log(`  Biblioteca:  ${livros} capa(s) migrada(s)`);
  console.log(`\n✓ Total: ${members + events + bens + livros} imagem(ns) movida(s) para o Blob.`);
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

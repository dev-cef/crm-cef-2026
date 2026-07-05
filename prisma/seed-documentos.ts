import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Popula as categorias padrão do Módulo de Documentos.
// Idempotente (upsert por nome) e sem dados fictícios — seguro em produção.
// Executar: npx tsx prisma/seed-documentos.ts

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const CATEGORIAS: { nome: string; descricao: string }[] = [
  { nome: "Estatuto",              descricao: "Estatuto social do CEF" },
  { nome: "Regimento Interno",     descricao: "Regimento interno do clube" },
  { nome: "Regras do Grupo",       descricao: "Regras de convivência e participação" },
  { nome: "Boas Práticas",         descricao: "Guias de boas práticas em atividades" },
  { nome: "Editais de Convocação", descricao: "Convocações de assembleias e eleições" },
  { nome: "Código de Ética",       descricao: "Código de ética do CEF" },
  { nome: "Atas",                  descricao: "Atas de reuniões e assembleias" },
  { nome: "Plano de Manejo",       descricao: "Planos de manejo de áreas e trilhas" },
  { nome: "Políticas",             descricao: "Políticas institucionais" },
  { nome: "Manuais",               descricao: "Manuais e procedimentos" },
  { nome: "Comunicados",           descricao: "Comunicados oficiais aos associados" },
  { nome: "Contratos",             descricao: "Contratos e convênios do clube" },
  { nome: "Financeiro",            descricao: "Documentos financeiros e prestações de contas" },
  { nome: "Relatórios",            descricao: "Relatórios administrativos e de atividades" },
  { nome: "Outros",                descricao: "Documentos diversos" },
];

async function main() {
  console.log("📄 Seed de categorias do Módulo de Documentos...");
  for (const [i, cat] of CATEGORIAS.entries()) {
    await prisma.documentoCategoria.upsert({
      where: { nome: cat.nome },
      update: { ordem: i },
      create: { nome: cat.nome, descricao: cat.descricao, ordem: i },
    });
    console.log(`  ✓ ${cat.nome}`);
  }
  console.log(`✅ ${CATEGORIAS.length} categorias garantidas.`);
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

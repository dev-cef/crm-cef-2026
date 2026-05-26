/**
 * Script temporário: marca até 2 associados ativos como isGuide=true para teste do form de eventos.
 * Prioriza quem tem alto interesse em escalada ou caminhada.
 *
 * Uso: npx tsx scripts/mark-test-guides.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const candidates = await prisma.member.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      isGuide: false,
      OR: [
        { interestClimbing: { gte: 3 } },
        { interestHiking: { gte: 3 } },
      ],
    },
    orderBy: [{ interestClimbing: "desc" }, { interestHiking: "desc" }],
    take: 2,
    select: {
      id: true,
      fullName: true,
      interestClimbing: true,
      interestHiking: true,
    },
  });

  if (candidates.length < 2) {
    const fallback = await prisma.member.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        isGuide: false,
        id: { notIn: candidates.map((c) => c.id) },
      },
      take: 2 - candidates.length,
      select: {
        id: true,
        fullName: true,
        interestClimbing: true,
        interestHiking: true,
      },
    });
    candidates.push(...fallback);
  }

  if (candidates.length === 0) {
    console.log("Nenhum associado ativo encontrado para marcar como guia.");
    return;
  }

  console.log("Marcando como guia:");
  for (const c of candidates) {
    console.log(
      `  - ${c.fullName} (escalada=${c.interestClimbing}, caminhada=${c.interestHiking})`,
    );
    await prisma.member.update({
      where: { id: c.id },
      data: { isGuide: true },
    });
  }

  const total = await prisma.member.count({ where: { isGuide: true } });
  console.log(`\nTotal de guias ativos agora: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

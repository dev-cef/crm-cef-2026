import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const plans = [
  {
    name: "Individual",
    monthlyPrice: 20,
    billingPeriod: "MENSAL",
    description: "Titular — cobrança mensal",
    active: true,
  },
  {
    name: "Família",
    monthlyPrice: 30,
    billingPeriod: "MENSAL",
    description: "Titular + 1 dependente (cônjuge) — cobrança mensal",
    active: true,
  },
  {
    name: "Individual",
    monthlyPrice: 200,
    billingPeriod: "ANUAL",
    description: "Titular — cobrança anual (equivale a 10 mensalidades)",
    active: true,
  },
  {
    name: "Família",
    monthlyPrice: 300,
    billingPeriod: "ANUAL",
    description:
      "Titular + 1 dependente (cônjuge) — cobrança anual (equivale a 10 mensalidades)",
    active: true,
  },
];

async function main() {
  for (const p of plans) {
    const exists = await prisma.plan.findFirst({
      where: { name: p.name, billingPeriod: p.billingPeriod },
    });
    if (!exists) {
      await prisma.plan.create({ data: p });
      console.log("Criado:", p.name, p.billingPeriod);
    } else {
      await prisma.plan.update({ where: { id: exists.id }, data: p });
      console.log("Atualizado:", p.name, p.billingPeriod);
    }
  }
  console.log("Concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

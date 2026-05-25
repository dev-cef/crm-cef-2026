import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, name: true, email: true, approved: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\n${admins.length} admin(s) cadastrado(s):\n`);
  for (const a of admins) {
    console.log(`  - ${a.email}  |  ${a.name}  |  approved=${a.approved}`);
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

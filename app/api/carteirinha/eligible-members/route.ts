import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkEligibility, currentQuarter } from "@/lib/physical-card";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { quarter, year } = currentQuarter();

  // Todos os membros ativos sem solicitação no trimestre corrente
  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      physicalCardRequests: {
        none: { quarter, year, requestType: "PRIMEIRA_VIA" },
      },
    },
    select: {
      id: true,
      fullName: true,
      registration: true,
      photoUrl: true,
      plan: { select: { name: true } },
      createdAt: true,
      eventRegistrations: {
        include: {
          event: {
            select: { name: true, dateTime: true, status: true, eventCategory: true },
          },
        },
      },
    },
    orderBy: { fullName: "asc" },
  });

  const result = members.map(({ eventRegistrations, createdAt, ...m }) => ({
    ...m,
    eligibility: checkEligibility(createdAt, eventRegistrations),
  }));

  // Elegíveis primeiro
  result.sort((a, b) => {
    if (a.eligibility.isEligible === b.eligibility.isEligible) return 0;
    return a.eligibility.isEligible ? -1 : 1;
  });

  return NextResponse.json(result);
}

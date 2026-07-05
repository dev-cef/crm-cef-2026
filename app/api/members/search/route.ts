import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasAtLeast } from "@/lib/rbac";

export async function GET(req: NextRequest) {
  // Busca do cadastro completo (nome, telefone, foto) — só staff.
  // Um ASSOCIADO nunca lista o quadro de sócios.
  const session = await auth();
  if (!session?.user?.id || !hasAtLeast(session.user, "DEPARTAMENTO")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const exclude = req.nextUrl.searchParams.get("exclude") ?? "";
  // mode=physical: busca todos os associados (sem filtro de plano familiar ou status)
  const physical = req.nextUrl.searchParams.get("mode") === "physical";

  if (q.length < 2) return NextResponse.json([]);

  const byReg = /^\d+$/.test(q) ? parseInt(q, 10) : null;

  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      ...(physical ? {} : { status: "ACTIVE", titularId: null, dependente: { is: null } }),
      ...(exclude ? { id: { not: exclude } } : {}),
      ...(byReg
        ? { registration: byReg }
        : { fullName: { contains: q } }),
    },
    select: {
      id: true,
      fullName: true,
      registration: true,
      photoUrl: true,
      status: true,
      phone: true,
      plan: { select: { name: true } },
      physicalCardRequests: physical
        ? {
            select: { currentStage: true, quarter: true, year: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          }
        : false,
    },
    take: 10,
    orderBy: { fullName: "asc" },
  });

  const normalized = members.map(({ physicalCardRequests, ...m }) => ({
    ...m,
    cardRequest: (physicalCardRequests as { currentStage: string; quarter: number; year: number }[] | undefined)?.[0] ?? null,
  }));

  return NextResponse.json(normalized);
}

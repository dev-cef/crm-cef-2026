import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const exclude = req.nextUrl.searchParams.get("exclude") ?? "";

  if (q.length < 2) return NextResponse.json([]);

  const byReg = /^\d+$/.test(q) ? parseInt(q, 10) : null;

  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      status: "ACTIVE",
      id: { not: exclude },
      titularId: null,
      dependente: { is: null },
      ...(byReg
        ? { registration: byReg }
        : { fullName: { contains: q } }),
    },
    select: {
      id: true,
      fullName: true,
      registration: true,
      photoUrl: true,
      phone: true,
      plan: { select: { name: true } },
    },
    take: 10,
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json(members);
}

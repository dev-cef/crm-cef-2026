"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { notifyReservaBiblioteca } from "@/lib/messenger";

type Result = { ok: boolean; error?: string };

// Associado reserva um livro disponível → cria a reserva e avisa a secretaria.
// A retirada e o registro do empréstimo continuam no balcão (admin).
export async function reservarLivro(livroId: string): Promise<Result> {
  const user = await requireUser();
  if (!user.memberId) return { ok: false, error: "Sua conta não está vinculada a um associado." };

  const livro = await prisma.bibliotecaLivro.findUnique({
    where: { id: livroId },
    select: {
      id: true,
      titulo: true,
      disponivel: true,
      emprestimos: {
        where: { status: { in: ["ativo", "atrasado"] } },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!livro) return { ok: false, error: "Livro não encontrado." };
  if (!livro.disponivel || livro.emprestimos.length > 0) {
    return { ok: false, error: "Este livro está emprestado no momento." };
  }

  // Já reservado por este associado? (o índice único também protege)
  const existente = await prisma.bibliotecaReserva.findFirst({
    where: { livroId, socioId: user.memberId, ativa: true },
    select: { id: true },
  });
  if (existente) return { ok: false, error: "Você já reservou este livro." };

  const member = await prisma.member.findUnique({
    where: { id: user.memberId },
    select: { fullName: true },
  });

  try {
    const reserva = await prisma.bibliotecaReserva.create({
      data: { livroId, socioId: user.memberId, ativa: true },
    });
    await recordAudit({
      userId: user.id,
      action: "CREATE",
      entity: "BibliotecaReserva",
      entityId: reserva.id,
      metadata: { livroId, livroTitulo: livro.titulo },
    });
    await notifyReservaBiblioteca({
      memberId: user.memberId,
      memberFullName: member?.fullName ?? "Associado",
      livroTitulo: livro.titulo,
    });
    revalidatePath("/meu-espaco/biblioteca");
    revalidatePath(`/biblioteca/${livroId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível reservar. Tente novamente." };
  }
}

// Associado cancela a própria reserva (só a dele).
export async function cancelarReserva(reservaId: string): Promise<Result> {
  const user = await requireUser();
  if (!user.memberId) return { ok: false, error: "Sua conta não está vinculada a um associado." };

  const reserva = await prisma.bibliotecaReserva.findUnique({
    where: { id: reservaId },
    select: { id: true, socioId: true, livroId: true },
  });
  if (!reserva || reserva.socioId !== user.memberId) {
    return { ok: false, error: "Reserva não encontrada." };
  }

  try {
    await prisma.bibliotecaReserva.delete({ where: { id: reservaId } });
    await recordAudit({
      userId: user.id,
      action: "DELETE",
      entity: "BibliotecaReserva",
      entityId: reservaId,
      metadata: { livroId: reserva.livroId, canceladaPeloAssociado: true },
    });
    revalidatePath("/meu-espaco/biblioteca");
    revalidatePath(`/biblioteca/${reserva.livroId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível cancelar. Tente novamente." };
  }
}

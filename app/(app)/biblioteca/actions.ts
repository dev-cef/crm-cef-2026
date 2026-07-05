"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { gerarNumeroTombo } from "@/lib/biblioteca/queries";

type Result = { ok: boolean; error?: string; id?: string };

// ── Livro ────────────────────────────────────────────────────────────────────

const livroSchema = z.object({
  titulo: z.string().min(2, "Título obrigatório"),
  autor: z.string().optional(),
  editora: z.string().optional(),
  anoPublicacao: z.coerce.number().int().min(1800).max(2030).optional(),
  isbn: z.string().optional(),
  categoriaId: z.string().optional(),
  origem: z.enum(["proprio", "doacao"]).default("proprio"),
  doadorNome: z.string().optional(),
  doadorSocioId: z.string().optional(),
  estado: z.enum(["otimo", "bom", "regular", "danificado", "perdido"]).default("otimo"),
  descricao: z.string().optional(),
  capaUrl: z.string().optional(),
  observacoes: z.string().optional(),
  numeroTombo: z.string().optional(),
});

export type LivroFormValues = z.infer<typeof livroSchema>;

export async function criarLivro(values: LivroFormValues): Promise<Result> {
  const session = await auth();
  const parsed = livroSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  try {
    const d = parsed.data;
    const numeroTombo = d.numeroTombo || (await gerarNumeroTombo());

    const livro = await prisma.bibliotecaLivro.create({
      data: {
        titulo: d.titulo,
        autor: d.autor || null,
        editora: d.editora || null,
        anoPublicacao: d.anoPublicacao ?? null,
        isbn: d.isbn || null,
        categoriaId: d.categoriaId || null,
        origem: d.origem,
        doadorNome: d.doadorNome || null,
        doadorSocioId: d.doadorSocioId || null,
        estado: d.estado,
        descricao: d.descricao || null,
        capaUrl: d.capaUrl || null,
        observacoes: d.observacoes || null,
        numeroTombo,
      },
    });

    await recordAudit({ userId: session?.user?.id, action: "CREATE", entity: "BibliotecaLivro", entityId: livro.id });
    revalidatePath("/biblioteca");
    return { ok: true, id: livro.id };
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") return { ok: false, error: "Número de tombo já existe." };
    console.error(e);
    return { ok: false, error: "Erro ao cadastrar o livro." };
  }
}

export async function atualizarLivro(id: string, values: LivroFormValues): Promise<Result> {
  const session = await auth();
  const parsed = livroSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  try {
    const d = parsed.data;
    await prisma.bibliotecaLivro.update({
      where: { id },
      data: {
        titulo: d.titulo,
        autor: d.autor || null,
        editora: d.editora || null,
        anoPublicacao: d.anoPublicacao ?? null,
        isbn: d.isbn || null,
        categoriaId: d.categoriaId || null,
        origem: d.origem,
        doadorNome: d.doadorNome || null,
        doadorSocioId: d.doadorSocioId || null,
        estado: d.estado,
        descricao: d.descricao || null,
        capaUrl: d.capaUrl || null,
        observacoes: d.observacoes || null,
        numeroTombo: d.numeroTombo || undefined,
      },
    });

    await recordAudit({ userId: session?.user?.id, action: "UPDATE", entity: "BibliotecaLivro", entityId: id });
    revalidatePath("/biblioteca");
    revalidatePath(`/biblioteca/${id}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao atualizar o livro." };
  }
}

export async function excluirLivro(id: string): Promise<Result> {
  const session = await auth();
  const ativo = await prisma.bibliotecaEmprestimo.findFirst({
    where: { livroId: id, status: { in: ["ativo", "atrasado"] } },
  });
  if (ativo) return { ok: false, error: "Não é possível excluir: livro com empréstimo ativo." };

  try {
    await prisma.bibliotecaLivro.delete({ where: { id } });
    await recordAudit({ userId: session?.user?.id, action: "DELETE", entity: "BibliotecaLivro", entityId: id });
    revalidatePath("/biblioteca");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao excluir o livro." };
  }
}

// ── Empréstimo ───────────────────────────────────────────────────────────────

const emprestimoSchema = z.object({
  livroId: z.string().min(1, "Livro obrigatório"),
  socioId: z.string().min(1, "Sócio obrigatório"),
  retiradoEm: z.string(),
  prazoDevolucao: z.string(),
  estadoRetirada: z.enum(["otimo", "bom", "regular", "danificado", "perdido"]).default("otimo"),
  observacoes: z.string().optional(),
});

export type EmprestimoFormValues = z.infer<typeof emprestimoSchema>;

export async function registrarEmprestimo(values: EmprestimoFormValues): Promise<Result> {
  const session = await auth();
  const parsed = emprestimoSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const d = parsed.data;
  const livro = await prisma.bibliotecaLivro.findUnique({ where: { id: d.livroId } });
  if (!livro) return { ok: false, error: "Livro não encontrado." };
  if (!livro.disponivel) return { ok: false, error: "Livro indisponível para empréstimo." };

  try {
    const emprestimo = await prisma.$transaction(async (tx) => {
      const e = await tx.bibliotecaEmprestimo.create({
        data: {
          livroId: d.livroId,
          socioId: d.socioId,
          retiradoEm: new Date(d.retiradoEm),
          prazoDevolucao: new Date(d.prazoDevolucao),
          estadoRetirada: d.estadoRetirada,
          observacoes: d.observacoes || null,
          registradoPorId: session?.user?.id ?? null,
        },
      });
      await tx.bibliotecaLivro.update({ where: { id: d.livroId }, data: { disponivel: false } });
      // Retirou o livro → encerra a reserva ativa desse sócio para ele (se houver).
      await tx.bibliotecaReserva.deleteMany({
        where: { livroId: d.livroId, socioId: d.socioId, ativa: true },
      });
      return e;
    });

    await recordAudit({ userId: session?.user?.id, action: "CREATE", entity: "BibliotecaEmprestimo", entityId: emprestimo.id });
    revalidatePath("/biblioteca");
    revalidatePath("/biblioteca/emprestimos");
    return { ok: true, id: emprestimo.id };
  } catch {
    return { ok: false, error: "Erro ao registrar empréstimo." };
  }
}

const devolucaoSchema = z.object({
  emprestimoId: z.string(),
  devolvidoEm: z.string(),
  estadoDevolucao: z.enum(["otimo", "bom", "regular", "danificado", "perdido"]),
  status: z.enum(["devolvido", "extraviado"]).default("devolvido"),
  observacoes: z.string().optional(),
});

export type DevolucaoFormValues = z.infer<typeof devolucaoSchema>;

export async function registrarDevolucao(values: DevolucaoFormValues): Promise<Result> {
  const session = await auth();
  const parsed = devolucaoSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };

  const d = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const emp = await tx.bibliotecaEmprestimo.update({
        where: { id: d.emprestimoId },
        data: {
          devolvidoEm: new Date(d.devolvidoEm),
          estadoDevolucao: d.estadoDevolucao,
          status: d.status,
          observacoes: d.observacoes || null,
        },
      });

      await tx.bibliotecaLivro.update({
        where: { id: emp.livroId },
        data: {
          disponivel: d.status === "devolvido",
          estado: d.estadoDevolucao,
        },
      });
    });

    await recordAudit({ userId: session?.user?.id, action: "UPDATE", entity: "BibliotecaEmprestimo", entityId: d.emprestimoId });
    revalidatePath("/biblioteca");
    revalidatePath("/biblioteca/emprestimos");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao registrar devolução." };
  }
}

// ── Categorias ───────────────────────────────────────────────────────────────

export async function criarCategoria(nome: string, descricao?: string): Promise<Result> {
  try {
    const cat = await prisma.bibliotecaCategoria.create({ data: { nome, descricao: descricao || null } });
    revalidatePath("/biblioteca/categorias");
    return { ok: true, id: cat.id };
  } catch {
    return { ok: false, error: "Categoria já existe ou erro ao criar." };
  }
}

export async function excluirCategoria(id: string): Promise<Result> {
  try {
    await prisma.bibliotecaCategoria.delete({ where: { id } });
    revalidatePath("/biblioteca/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Não é possível excluir: categoria em uso." };
  }
}

// ── CSV ───────────────────────────────────────────────────────────────────────

export async function exportarCatalogoCsv(): Promise<string> {
  const livros = await prisma.bibliotecaLivro.findMany({
    orderBy: { titulo: "asc" },
    include: { categoria: true },
  });

  const header = "Tombo,Título,Autor,Editora,Ano,Categoria,Origem,Estado,Disponível\n";
  const rows = livros
    .map((l) =>
      [
        l.numeroTombo ?? "",
        `"${l.titulo}"`,
        `"${l.autor ?? ""}"`,
        `"${l.editora ?? ""}"`,
        l.anoPublicacao ?? "",
        l.categoria?.nome ?? "",
        l.origem === "doacao" ? "Doação" : "Próprio",
        l.estado,
        l.disponivel ? "Sim" : "Não",
      ].join(","),
    )
    .join("\n");

  return header + rows;
}

// ── Google Books ISBN lookup ──────────────────────────────────────────────────

export type IsbnData = {
  titulo?: string;
  autor?: string;
  editora?: string;
  anoPublicacao?: number;
  descricao?: string;
  capaUrl?: string;
};

export async function buscarPorIsbn(isbn: string): Promise<{ ok: boolean; data?: IsbnData; error?: string }> {
  const clean = isbn.replace(/[-\s]/g, "");
  if (!clean) return { ok: false, error: "ISBN inválido." };

  // 1. Open Library (sem limite de requisições)
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${clean}&format=json&jscmd=data`,
      { next: { revalidate: 86400 } },
    );
    if (res.ok) {
      const json = await res.json();
      const info = json[`ISBN:${clean}`];
      if (info) {
        const capa = info.cover?.large ?? info.cover?.medium ?? info.cover?.small;
        return {
          ok: true,
          data: {
            titulo: info.title ?? undefined,
            autor: info.authors?.map((a: { name: string }) => a.name).join(", ") ?? undefined,
            editora: info.publishers?.[0]?.name ?? undefined,
            anoPublicacao: info.publish_date ? parseInt(info.publish_date.slice(-4)) : undefined,
            descricao: info.description
              ? (typeof info.description === "string" ? info.description : info.description.value ?? "").slice(0, 1000)
              : undefined,
            capaUrl: capa ? capa.replace("http://", "https://") : undefined,
          },
        };
      }
    }
  } catch {
    // segue para Google Books
  }

  // 2. Google Books (fallback)
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${clean}&maxResults=1`,
      { next: { revalidate: 86400 } },
    );
    if (!res.ok) return { ok: false, error: "Livro não encontrado. Preencha os campos manualmente." };

    const json = await res.json();
    const info = json?.items?.[0]?.volumeInfo;
    if (!info) return { ok: false, error: "Livro não encontrado. Preencha os campos manualmente." };

    const capa =
      info.imageLinks?.extraLarge ??
      info.imageLinks?.large ??
      info.imageLinks?.medium ??
      info.imageLinks?.thumbnail;

    return {
      ok: true,
      data: {
        titulo: info.title ?? undefined,
        autor: info.authors?.join(", ") ?? undefined,
        editora: info.publisher ?? undefined,
        anoPublicacao: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4)) : undefined,
        descricao: info.description ? info.description.slice(0, 1000) : undefined,
        capaUrl: capa ? capa.replace("http://", "https://") : undefined,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao buscar livro." };
  }
}

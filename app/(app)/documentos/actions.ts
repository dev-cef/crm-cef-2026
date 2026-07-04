"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { toSessionUser, type SessionUser } from "@/lib/rbac";
import type { PermissionAction } from "@/lib/modules";
import { isValidDriveUrl } from "@/lib/documentos/types";

type Result = { ok: boolean; error?: string; id?: string };

// Valida sessão + permissão no módulo "documentos". null = negado.
async function requirePermission(action: PermissionAction): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = toSessionUser(session.user);
  return (await can(user, "documentos", action)) ? user : null;
}

const SEM_PERMISSAO = "Você não tem permissão para esta ação.";

// ── Documento ────────────────────────────────────────────────────────────────

const documentoSchema = z.object({
  titulo: z.string().min(2, "Título obrigatório"),
  descricao: z.string().optional(),
  categoriaId: z.string().min(1, "Categoria obrigatória"),
  driveUrl: z
    .string()
    .min(1, "Link do Google Drive obrigatório")
    .refine(isValidDriveUrl, "Informe um link válido do Google Drive (https://drive.google.com/...)"),
  publicadoEm: z.string().min(1, "Data de publicação obrigatória"),
  validadeEm: z.string().optional(),
  versao: z.string().min(1, "Versão obrigatória"),
  status: z.enum(["ATIVO", "ARQUIVADO", "EM_REVISAO"]).default("ATIVO"),
  nivelAcesso: z.enum(["ASSOCIADOS", "DIRETORIA", "ADMIN"]).default("ASSOCIADOS"),
  permitirDownload: z.boolean().default(true),
  tags: z.string().optional(), // separadas por vírgula
});

export type DocumentoFormValues = z.infer<typeof documentoSchema>;

function tagsToJson(tags?: string): string {
  const list = (tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return JSON.stringify([...new Set(list)]);
}

export async function criarDocumento(values: DocumentoFormValues): Promise<Result> {
  const user = await requirePermission("create");
  if (!user) return { ok: false, error: SEM_PERMISSAO };

  const parsed = documentoSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  // Nível ADMIN (confidencial) só pode ser definido por administradores.
  if (d.nivelAcesso === "ADMIN" && user.role !== "ADMIN") {
    return { ok: false, error: "Somente administradores podem criar documentos confidenciais." };
  }

  try {
    const documento = await prisma.documento.create({
      data: {
        titulo: d.titulo,
        descricao: d.descricao || null,
        categoriaId: d.categoriaId,
        driveUrl: d.driveUrl,
        publicadoEm: new Date(d.publicadoEm),
        validadeEm: d.validadeEm ? new Date(d.validadeEm) : null,
        versao: d.versao,
        status: d.status,
        nivelAcesso: d.nivelAcesso,
        permitirDownload: d.permitirDownload,
        tags: tagsToJson(d.tags),
        criadoPorId: user.id,
      },
    });

    await recordAudit({ userId: user.id, action: "CREATE", entity: "Documento", entityId: documento.id });
    revalidatePath("/documentos");
    revalidatePath("/meu-espaco/documentos");
    return { ok: true, id: documento.id };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Erro ao cadastrar o documento." };
  }
}

export async function atualizarDocumento(id: string, values: DocumentoFormValues): Promise<Result> {
  const user = await requirePermission("edit");
  if (!user) return { ok: false, error: SEM_PERMISSAO };

  const parsed = documentoSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  const atual = await prisma.documento.findUnique({ where: { id } });
  if (!atual) return { ok: false, error: "Documento não encontrado." };

  // Documentos confidenciais (nível ADMIN) são intocáveis fora do papel ADMIN.
  if ((atual.nivelAcesso === "ADMIN" || d.nivelAcesso === "ADMIN") && user.role !== "ADMIN") {
    return { ok: false, error: "Somente administradores podem alterar documentos confidenciais." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Versão ou arquivo mudou → guarda snapshot da versão anterior.
      if (atual.versao !== d.versao || atual.driveUrl !== d.driveUrl) {
        await tx.documentoVersao.create({
          data: {
            documentoId: id,
            versao: atual.versao,
            driveUrl: atual.driveUrl,
            observacao: `Substituída pela versão ${d.versao}`,
            criadoPorId: user.id,
          },
        });
      }

      await tx.documento.update({
        where: { id },
        data: {
          titulo: d.titulo,
          descricao: d.descricao || null,
          categoriaId: d.categoriaId,
          driveUrl: d.driveUrl,
          publicadoEm: new Date(d.publicadoEm),
          validadeEm: d.validadeEm ? new Date(d.validadeEm) : null,
          versao: d.versao,
          status: d.status,
          nivelAcesso: d.nivelAcesso,
          permitirDownload: d.permitirDownload,
          tags: tagsToJson(d.tags),
          atualizadoPorId: user.id,
        },
      });
    });

    await recordAudit({ userId: user.id, action: "UPDATE", entity: "Documento", entityId: id });
    revalidatePath("/documentos");
    revalidatePath(`/documentos/${id}`);
    revalidatePath("/meu-espaco/documentos");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Erro ao atualizar o documento." };
  }
}

export async function arquivarDocumento(id: string): Promise<Result> {
  const user = await requirePermission("edit");
  if (!user) return { ok: false, error: SEM_PERMISSAO };

  const atual = await prisma.documento.findUnique({ where: { id } });
  if (!atual) return { ok: false, error: "Documento não encontrado." };
  if (atual.nivelAcesso === "ADMIN" && user.role !== "ADMIN") {
    return { ok: false, error: "Somente administradores podem alterar documentos confidenciais." };
  }

  const novoStatus = atual.status === "ARQUIVADO" ? "ATIVO" : "ARQUIVADO";
  try {
    await prisma.documento.update({
      where: { id },
      data: { status: novoStatus, atualizadoPorId: user.id },
    });
    await recordAudit({
      userId: user.id,
      action: "UPDATE",
      entity: "Documento",
      entityId: id,
      metadata: { status: novoStatus },
    });
    revalidatePath("/documentos");
    revalidatePath(`/documentos/${id}`);
    revalidatePath("/meu-espaco/documentos");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao arquivar o documento." };
  }
}

export async function excluirDocumento(id: string): Promise<Result> {
  const user = await requirePermission("delete");
  if (!user) return { ok: false, error: SEM_PERMISSAO };

  const atual = await prisma.documento.findUnique({ where: { id } });
  if (!atual) return { ok: false, error: "Documento não encontrado." };
  if (atual.nivelAcesso === "ADMIN" && user.role !== "ADMIN") {
    return { ok: false, error: "Somente administradores podem excluir documentos confidenciais." };
  }

  try {
    await prisma.documento.delete({ where: { id } });
    await recordAudit({
      userId: user.id,
      action: "DELETE",
      entity: "Documento",
      entityId: id,
      metadata: { titulo: atual.titulo },
    });
    revalidatePath("/documentos");
    revalidatePath("/meu-espaco/documentos");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao excluir o documento." };
  }
}

// ── Categorias ───────────────────────────────────────────────────────────────

export async function criarDocCategoria(nome: string, descricao?: string): Promise<Result> {
  const user = await requirePermission("create");
  if (!user || user.role !== "ADMIN") return { ok: false, error: SEM_PERMISSAO };
  if (!nome.trim()) return { ok: false, error: "Nome obrigatório." };

  try {
    const cat = await prisma.documentoCategoria.create({
      data: { nome: nome.trim(), descricao: descricao?.trim() || null },
    });
    await recordAudit({ userId: user.id, action: "CREATE", entity: "DocumentoCategoria", entityId: cat.id });
    revalidatePath("/documentos/categorias");
    return { ok: true, id: cat.id };
  } catch {
    return { ok: false, error: "Categoria já existe ou erro ao criar." };
  }
}

export async function excluirDocCategoria(id: string): Promise<Result> {
  const user = await requirePermission("delete");
  if (!user || user.role !== "ADMIN") return { ok: false, error: SEM_PERMISSAO };

  const emUso = await prisma.documento.count({ where: { categoriaId: id } });
  if (emUso > 0) {
    return { ok: false, error: `Não é possível excluir: ${emUso} documento(s) nesta categoria.` };
  }

  try {
    await prisma.documentoCategoria.delete({ where: { id } });
    await recordAudit({ userId: user.id, action: "DELETE", entity: "DocumentoCategoria", entityId: id });
    revalidatePath("/documentos/categorias");
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro ao excluir a categoria." };
  }
}

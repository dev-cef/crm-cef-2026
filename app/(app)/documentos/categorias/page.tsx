import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { getDocCategorias } from "@/lib/documentos/queries";
import CategoriasClient from "./categorias-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categorias — Documentos CEF" };

export default async function DocCategoriasPage() {
  const user = await requireAdmin();
  if (!user) redirect("/documentos");

  const categorias = await getDocCategorias();
  return (
    <CategoriasClient
      categorias={categorias.map((c) => ({
        id: c.id,
        nome: c.nome,
        descricao: c.descricao,
        totalDocumentos: c._count.documentos,
      }))}
    />
  );
}

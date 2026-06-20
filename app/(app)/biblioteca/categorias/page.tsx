import { getCategorias } from "@/lib/biblioteca/queries";
import CategoriasClient from "./categorias-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categorias — Biblioteca CEF" };

export default async function CategoriasPage() {
  const categorias = await getCategorias();
  return <CategoriasClient categorias={categorias} />;
}

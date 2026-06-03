import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getTransactionCategories } from "@/app/(app)/financeiro/actions";
import { CategoryManager } from "@/components/modules/financeiro/category-manager";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const categories = await getTransactionCategories();

  return (
    <div>
      <Link
        href="/financeiro"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Financeiro
      </Link>

      <PageHeader
        title="Categorias"
        description="Gerencie as categorias e subcategorias de entradas e saídas"
      />

      <CategoryManager initialCategories={categories} />
    </div>
  );
}

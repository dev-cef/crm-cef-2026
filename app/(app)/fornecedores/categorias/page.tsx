import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { getSupplierCategories } from "@/app/(app)/fornecedores/actions";
import { SupplierCategoryManager } from "@/components/modules/fornecedores/supplier-category-manager";

export const dynamic = "force-dynamic";

export default async function SupplierCategoriasPage() {
  const categories = await getSupplierCategories();

  return (
    <div>
      <Link
        href="/fornecedores"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Fornecedores
      </Link>

      <PageHeader
        title="Categorias de Fornecedores"
        description="Adicione, renomeie e organize a ordem das categorias"
      />

      <SupplierCategoryManager initialCategories={categories} />
    </div>
  );
}

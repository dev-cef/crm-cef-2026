"use client";

import { Printer, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  const router = useRouter();
  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ArrowLeft className="size-4" /> Voltar
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer className="size-4" /> Imprimir / Salvar PDF
      </Button>
    </div>
  );
}

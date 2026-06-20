"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportarBensCSV } from "@/app/(app)/patrimonio/actions";
import type { BemFilters } from "@/lib/patrimonio/types";

export function ExportButton({ filters }: { filters: BemFilters }) {
  const [loading, setLoading] = useState(false);

  async function handle() {
    setLoading(true);
    const csv = await exportarBensCSV(filters);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patrimonio-cef-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
  }

  return (
    <Button variant="outline" size="sm" onClick={handle} disabled={loading}>
      <Download className="size-4 mr-1" />
      {loading ? "Exportando..." : "Exportar CSV"}
    </Button>
  );
}

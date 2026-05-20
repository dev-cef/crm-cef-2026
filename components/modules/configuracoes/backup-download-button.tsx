"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function BackupDownloadButton() {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) throw new Error("Falha ao gerar backup");

      const blob = await res.blob();
      const date = new Date().toISOString().split("T")[0];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-crm-cef-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup gerado e salvo com sucesso");
    } catch {
      toast.error("Erro ao gerar backup. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleDownload} disabled={loading} className="gap-2">
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      {loading ? "Gerando backup…" : "Baixar backup"}
    </Button>
  );
}

"use client";

import { useRef, useState } from "react";
import { AlertCircle, Download, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type RowResult = { row: number; name: string; ok: boolean; error?: string };
type ImportResult = { created: number; errors: number; results: RowResult[] };

const CSV_TEMPLATE = [
  "nome;sexo;email;telefone;data_nascimento;cpf;cep;logradouro;numero;complemento;bairro;cidade;estado;tipo_sanguineo;contato_emergencia_nome;contato_emergencia_tel;experiencia_montanha;plano",
  "João da Silva;M;joao@email.com;(22) 99999-0001;15/03/1985;529.982.247-25;28625-000;Rua das Flores;123;;Centro;Nova Friburgo;RJ;O+;Maria da Silva;(22) 99999-0002;MAIS_5;Sócio Efetivo",
].join("\r\n");

function downloadTemplate() {
  const blob = new Blob(["﻿" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modelo-importacao-associados.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportCsvDialog({ children }: { children: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setResult(null);
    setLoading(false);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) reset();
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/associados/import-csv", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao importar");
        return;
      }
      setResult(data as ImportResult);
      if ((data as ImportResult).created > 0) {
        toast.success(
          `${(data as ImportResult).created} associado(s) importado(s) com sucesso`,
        );
      }
    } catch {
      toast.error("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children} />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Associados via CSV</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* Template download */}
            <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Modelo de importação</p>
                  <p className="text-xs text-muted-foreground">
                    Baixe, preencha e importe o CSV
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="size-4" /> Baixar modelo
              </Button>
            </div>

            {/* Campos obrigatórios */}
            <div className="rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Colunas obrigatórias:</p>
              <p className="font-mono leading-relaxed">
                nome, sexo (M/F), email, telefone, data_nascimento (DD/MM/AAAA), cpf, cep,
                logradouro, numero, bairro, cidade, estado (UF), tipo_sanguineo, contato_emergencia_nome,
                contato_emergencia_tel
              </p>
              <p className="mt-1.5">
                Opcionais: complemento, experiencia_montanha, plano
              </p>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f?.name.endsWith(".csv") || f?.type === "text/csv") setFile(f);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed py-8 transition-colors",
                file ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50",
              )}
            >
              <Upload className="size-6 text-muted-foreground" />
              {file ? (
                <div className="text-center">
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium">Clique ou arraste o arquivo CSV</p>
                  <p className="text-xs text-muted-foreground">Apenas arquivos .csv</p>
                </div>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleImport} disabled={!file || loading}>
                {loading ? "Importando…" : "Importar"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-green-50 p-4 text-center dark:bg-green-950/30">
                <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                  {result.created}
                </p>
                <p className="text-xs text-green-600 dark:text-green-500">Importados</p>
              </div>
              <div
                className={cn(
                  "rounded-lg p-4 text-center",
                  result.errors > 0
                    ? "bg-red-50 dark:bg-red-950/30"
                    : "bg-muted",
                )}
              >
                <p
                  className={cn(
                    "text-3xl font-bold",
                    result.errors > 0
                      ? "text-red-700 dark:text-red-400"
                      : "text-muted-foreground",
                  )}
                >
                  {result.errors}
                </p>
                <p
                  className={cn(
                    "text-xs",
                    result.errors > 0
                      ? "text-red-600 dark:text-red-500"
                      : "text-muted-foreground",
                  )}
                >
                  Erros
                </p>
              </div>
            </div>

            {/* Error list */}
            {result.errors > 0 && (
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {result.results
                  .filter((r) => !r.ok)
                  .map((r) => (
                    <div
                      key={r.row}
                      className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs dark:bg-red-950/20"
                    >
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                      <span>
                        <strong>Linha {r.row}</strong>
                        {r.name ? ` — ${r.name}` : ""}: {r.error}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {result.errors > 0 && (
                <Button variant="outline" onClick={reset}>
                  Tentar novamente
                </Button>
              )}
              <Button onClick={() => handleOpenChange(false)}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

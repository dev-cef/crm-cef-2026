"use client";

// Upload de arquivo pro Google Drive do CEF, direto do navegador (resumable):
// 1) pede a sessão ao servidor (só metadados), 2) PUT do arquivo na URL do
// Google com progresso, 3) confirma no servidor (libera leitura por link) e
// devolve o driveUrl pro formulário.
//
// Fluxo em etapas: solta/seleciona o arquivo → fica "staged" (dá pra remover)
// → "Enviar arquivo" inicia o upload (dá pra cancelar) → concluído.

import { useRef, useState } from "react";
import { CheckCircle2, CloudUpload, File as FileIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DRIVE_ACCEPT,
  DRIVE_ALLOWED_MIME,
  DRIVE_MAX_BYTES,
  formatBytes,
} from "@/lib/documentos/upload-constants";

type Phase = "idle" | "staged" | "uploading" | "done";

export function DriveUpload({
  driveReady,
  categoria,
  onUploaded,
}: {
  driveReady: boolean;
  categoria: string | null; // nome da categoria selecionada → subpasta no Drive
  onUploaded: (r: { driveUrl: string; fileId: string; fileName: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [staged, setStaged] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validação client-side antes de qualquer request — o servidor revalida.
  function stageFiles(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files);
    if (list.length === 0) return;
    if (list.length > 1) {
      fail("Envie um arquivo por vez — cada documento tem um único arquivo.");
      return;
    }
    const file = list[0];
    if (!DRIVE_ALLOWED_MIME.has(file.type)) {
      fail(`Formato não aceito (${file.type || "desconhecido"}). Use PDF, Office ou imagem.`);
      return;
    }
    if (file.size === 0) {
      fail("O arquivo está vazio.");
      return;
    }
    if (file.size > DRIVE_MAX_BYTES) {
      fail(`Arquivo de ${formatBytes(file.size)} excede o limite de ${formatBytes(DRIVE_MAX_BYTES)}.`);
      return;
    }
    setStaged(file);
    setPhase("staged");
  }

  function fail(msg: string) {
    setError(msg);
    toast.error(msg);
  }

  async function handleUpload() {
    const file = staged;
    if (!file) return;
    if (!categoria) {
      fail("Selecione a categoria antes de enviar — ela define a pasta no Drive.");
      return;
    }
    setPhase("uploading");
    setProgress(0);
    setError(null);
    try {
      // 1) Sessão resumable (o servidor valida tipo/tamanho/permissão).
      const start = await fetch("/api/documentos/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "start",
          name: file.name,
          mimeType: file.type,
          size: file.size,
          categoria,
        }),
      });
      const startJson = await start.json();
      if (!start.ok) throw new Error(startJson.error ?? "Falha ao iniciar o upload.");

      // 2) PUT direto pro Google com progresso (XHR — fetch não expõe progresso de upload).
      const fileId = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open("PUT", startJson.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status === 200 || xhr.status === 201) {
            try {
              resolve(JSON.parse(xhr.responseText).id as string);
            } catch {
              reject(new Error("Resposta inesperada do Google Drive."));
            }
          } else {
            reject(new Error(`Upload interrompido (HTTP ${xhr.status}). Tente novamente.`));
          }
        };
        xhr.onerror = () => reject(new Error("Falha de rede durante o upload."));
        xhr.onabort = () => reject(new DOMException("cancelado", "AbortError"));
        xhr.send(file);
      });

      // 3) Confirmação: libera leitura por link e recebe o driveUrl.
      const finish = await fetch("/api/documentos/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "finish", fileId }),
      });
      const finishJson = await finish.json();
      if (!finish.ok) throw new Error(finishJson.error ?? "Falha ao confirmar o upload.");

      setPhase("done");
      onUploaded({
        driveUrl: finishJson.driveUrl as string,
        fileId: finishJson.fileId as string,
        fileName: file.name,
      });
      toast.success("Arquivo enviado pro Drive do CEF!");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Cancelado pelo usuário: volta pro staged, arquivo pronto pra reenviar.
        // A sessão resumable abandonada expira sozinha no Google.
        setPhase("staged");
        toast.info("Upload cancelado.");
      } else {
        setPhase("staged");
        fail(err instanceof Error ? err.message : "Erro no upload.");
      }
    } finally {
      xhrRef.current = null;
    }
  }

  function reset() {
    setStaged(null);
    setProgress(0);
    setError(null);
    setPhase("idle");
  }

  if (!driveReady) {
    return (
      <p className="text-xs text-muted-foreground">
        O Google Drive do CEF ainda não foi conectado — peça a um administrador para conectar em{" "}
        <span className="font-medium">Documentos</span>, ou cole um link manualmente.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={DRIVE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) stageFiles(e.target.files);
          e.target.value = ""; // permite re-selecionar o mesmo arquivo
        }}
      />

      {/* Zona de drop — também clicável pra abrir o seletor */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Enviar arquivo — arraste e solte ou clique para selecionar"
        onClick={() => phase !== "uploading" && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && phase !== "uploading") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (phase !== "uploading") setDragActive(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (phase !== "uploading") setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (phase !== "uploading") stageFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/40",
          phase === "uploading" && "cursor-default opacity-80",
        )}
      >
        {phase === "idle" && (
          <>
            <CloudUpload className={cn("size-6", dragActive ? "text-primary" : "text-muted-foreground")} />
            <p className="text-sm">
              {dragActive ? (
                <span className="font-medium text-primary">Solte o arquivo aqui</span>
              ) : (
                <>
                  <span className="font-medium">Arraste e solte</span> o arquivo aqui, ou{" "}
                  <span className="underline underline-offset-2">clique para selecionar</span>
                </>
              )}
            </p>
          </>
        )}

        {(phase === "staged" || phase === "uploading") && staged && (
          <div className="w-full space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-2 text-sm">
              <FileIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="max-w-[60%] truncate font-medium">{staged.name}</span>
              <span className="text-xs text-muted-foreground">{formatBytes(staged.size)}</span>
              {phase === "staged" && (
                <button
                  type="button"
                  title="Remover arquivo"
                  onClick={reset}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {phase === "staged" ? (
              <Button type="button" size="sm" onClick={handleUpload}>
                <CloudUpload className="size-4" /> Enviar arquivo
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" /> Enviando… {progress}%
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={() => xhrRef.current?.abort()}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === "done" && staged && (
          <div className="w-full space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="flex items-center justify-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" /> {staged.name} enviado!
            </p>
            <Button type="button" size="sm" variant="outline" onClick={reset}>
              Enviar outro arquivo
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        PDF, Office ou imagem, até {formatBytes(DRIVE_MAX_BYTES)}. O arquivo vai pra pasta da
        categoria
        {categoria ? (
          <>
            {" "}
            (<span className="font-medium">CRM CEF — Documentos / {categoria}</span>)
          </>
        ) : (
          " selecionada"
        )}{" "}
        no Drive do clube e o link é preenchido automaticamente.
      </p>
    </div>
  );
}

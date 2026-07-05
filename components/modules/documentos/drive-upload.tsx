"use client";

// Upload de arquivo pro Google Drive do CEF, direto do navegador (resumable):
// 1) pede a sessão ao servidor (só metadados), 2) PUT do arquivo na URL do
// Google com progresso, 3) confirma no servidor (libera leitura por link) e
// devolve o driveUrl pro formulário.

import { useRef, useState } from "react";
import { CheckCircle2, CloudUpload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.jpg,.jpeg,.png,.webp";

type Phase = "idle" | "uploading" | "done";

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
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!categoria) {
      toast.error("Selecione a categoria antes de enviar — ela define a pasta no Drive.");
      return;
    }
    setPhase("uploading");
    setProgress(0);
    setFileName(file.name);
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
      setPhase("idle");
      setFileName(null);
      toast.error(err instanceof Error ? err.message : "Erro no upload.");
    }
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
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = ""; // permite reenviar o mesmo arquivo
        }}
      />
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={phase === "uploading"}
          onClick={() => inputRef.current?.click()}
        >
          {phase === "uploading" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CloudUpload className="size-4" />
          )}
          {phase === "done" ? "Enviar outro arquivo" : "Enviar arquivo"}
        </Button>
        {phase === "uploading" && (
          <span className="text-xs text-muted-foreground">
            {fileName} — {progress}%
          </span>
        )}
        {phase === "done" && fileName && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" /> {fileName}
          </span>
        )}
      </div>
      {phase === "uploading" && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        PDF, Office ou imagem, até 100 MB. O arquivo vai pra pasta da categoria
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

"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileUp, Loader2, Paperclip, Zap } from "lucide-react";
import { toast } from "sonner";
import { getOrCreateAsaasCharge } from "@/app/(app)/meu-espaco/actions";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
const PIX_KEY_TYPE_LABEL: Record<string, string> = {
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  TELEFONE: "Telefone",
  ALEATORIA: "Chave aleatória",
};

type AsaasData = { pixPayload: string; qrDataUrl: string; expiresAt: string };

type Props = {
  trigger: React.ReactElement;
  paymentId: string;
  amount: number;
  referenceLabel: string;
  dueDateLabel: string;
  status: string;
  receiptSubmittedAtLabel: string | null;
  billingMode: "MANUAL" | "ASAAS";
  initialAsaas: AsaasData | null;
  pixKey: string | null;
  pixKeyType: string | null;
  pixPayload: string | null;
  qrDataUrl: string | null;
  bankName: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  accountHolderName: string | null;
};

export function PaymentDialog(props: Props) {
  const {
    trigger,
    paymentId,
    amount,
    referenceLabel,
    dueDateLabel,
    status,
    receiptSubmittedAtLabel,
    billingMode,
    initialAsaas,
    pixKey,
    pixKeyType,
    pixPayload,
    qrDataUrl,
    bankName,
    bankAgency,
    bankAccount,
    accountHolderName,
  } = props;

  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileDataUri, setFileDataUri] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const [asaasData, setAsaasData] = useState<AsaasData | null>(initialAsaas);
  const [asaasLoading, setAsaasLoading] = useState(false);
  const [asaasError, setAsaasError] = useState<string | null>(null);

  const awaitingReview = status === "AGUARDANDO_CONFIRMACAO";
  const hasBankInfo = bankName || bankAgency || bankAccount;
  const isAsaasMode = billingMode === "ASAAS";
  const showUploadForm = !awaitingReview || resending;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setResending(false);
      setFileDataUri(null);
      setFileName(null);
    }
  }

  useEffect(() => {
    if (!open || awaitingReview || !isAsaasMode) return;
    const expired = asaasData && new Date(asaasData.expiresAt).getTime() <= Date.now();
    if (asaasData && !expired) return;

    let cancelled = false;
    setAsaasLoading(true);
    setAsaasError(null);
    getOrCreateAsaasCharge(paymentId).then((res) => {
      if (cancelled) return;
      setAsaasLoading(false);
      if (res.ok) {
        setAsaasData({ pixPayload: res.pixPayload, qrDataUrl: res.qrDataUrl, expiresAt: res.expiresAt });
      } else {
        setAsaasError(res.error);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isAsaasMode, awaitingReview]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
      toast.error("Use uma imagem (JPG/PNG) ou PDF.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 3MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUri(String(reader.result));
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function copyToClipboard(text: string | null) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar o código.");
    }
  }

  function handleSend() {
    if (!fileDataUri) {
      toast.error("Selecione o arquivo do comprovante.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/meu-espaco/receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId, fileDataUri }),
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          toast.success("Comprovante enviado! O financeiro foi avisado e vai conferir o pagamento.");
          setOpen(false);
          setFileDataUri(null);
          setFileName(null);
          setResending(false);
          router.refresh();
        } else {
          toast.error(data.error || "Erro ao enviar comprovante.");
        }
      } catch {
        toast.error("Erro ao enviar comprovante. Verifique sua conexão.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cobrança — {referenceLabel}</DialogTitle>
          <DialogDescription>
            Vencimento em {dueDateLabel} · <strong>{formatBRL(amount)}</strong>
          </DialogDescription>
        </DialogHeader>

        {awaitingReview && !resending && (
          <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <p className="font-medium">Comprovante em análise</p>
            <p className="mt-0.5 text-xs opacity-80">
              Enviado {receiptSubmittedAtLabel ? `em ${receiptSubmittedAtLabel}` : ""}. Assim que o
              financeiro confirmar o recebimento, esta cobrança será marcada como paga.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => setResending(true)}>
              <FileUp className="size-3.5" /> Reenviar comprovante
            </Button>
          </div>
        )}

        {showUploadForm && (
          <div className="space-y-4">
            {awaitingReview && resending && (
              <p className="text-xs text-muted-foreground">
                O novo arquivo substitui o comprovante enviado anteriormente.
              </p>
            )}
            {!awaitingReview && (
              <>
                {isAsaasMode ? (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Zap className="size-3.5 text-primary" /> Pague com PIX (automático)
                    </p>
                    {asaasLoading && (
                      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" /> Gerando o QR Code...
                      </div>
                    )}
                    {!asaasLoading && asaasData && (
                      <>
                        <div className="flex justify-center py-1">
                          <Image
                            src={asaasData.qrDataUrl}
                            alt="QR Code PIX"
                            width={180}
                            height={180}
                            className="rounded-md border"
                            unoptimized
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1.5 text-xs">
                          <span className="truncate">Código copia e cola</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(asaasData.pixPayload)}
                          >
                            <Copy className="size-3.5" /> Copiar
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Confirmação automática — assim que o pagamento cair, esta cobrança é dada
                          como paga sozinha. Não é necessário enviar comprovante.
                        </p>
                      </>
                    )}
                    {!asaasLoading && !asaasData && asaasError && (
                      <p className="text-sm text-muted-foreground">{asaasError}</p>
                    )}
                  </div>
                ) : pixKey ? (
                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium">Pague com PIX</p>
                    {qrDataUrl && (
                      <div className="flex justify-center py-1">
                        <Image
                          src={qrDataUrl}
                          alt="QR Code PIX"
                          width={180}
                          height={180}
                          className="rounded-md border"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1.5 text-xs">
                      <span className="truncate">
                        {PIX_KEY_TYPE_LABEL[pixKeyType ?? ""] ?? "Chave"}: {pixKey}
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={() => copyToClipboard(pixPayload)}>
                        <Copy className="size-3.5" /> Copiar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Dados de PIX ainda não configurados. Entre em contato com o financeiro.
                  </p>
                )}

                {hasBankInfo && (
                  <div className="space-y-1 rounded-md border p-3 text-sm">
                    <p className="font-medium">Transferência bancária</p>
                    {accountHolderName && <p className="text-muted-foreground">Titular: {accountHolderName}</p>}
                    {bankName && <p className="text-muted-foreground">Banco: {bankName}</p>}
                    {bankAgency && <p className="text-muted-foreground">Agência: {bankAgency}</p>}
                    {bankAccount && <p className="text-muted-foreground">Conta: {bankAccount}</p>}
                  </div>
                )}
              </>
            )}

            <div className="space-y-2 rounded-md border border-dashed p-3">
              <p className="text-sm font-medium">
                {resending
                  ? "Selecione o novo comprovante"
                  : isAsaasMode
                    ? "Pagou de outra forma? Envie o comprovante"
                    : "Já pagou? Envie o comprovante"}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={handleFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                <FileUp className="size-4" /> Selecionar arquivo
              </Button>
              {fileName && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Paperclip className="size-3" /> {fileName}
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Fechar
          </DialogClose>
          {resending && (
            <Button type="button" variant="outline" onClick={() => setResending(false)}>
              Cancelar
            </Button>
          )}
          {showUploadForm && (
            <Button onClick={handleSend} disabled={pending || !fileDataUri}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Enviar comprovante
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

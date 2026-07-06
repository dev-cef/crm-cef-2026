"use client";

/* eslint-disable @next/next/no-img-element -- imagem é data URI base64, next/image não otimiza */

import { useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aprovarComprovante, rejeitarComprovante } from "@/app/(app)/financeiro/comprovantes/actions";

export type PaymentOption = { id: string; label: string };

export function ComprovanteReviewCard({
  id,
  imageDataUri,
  senderLabel,
  memberName,
  motivoLabel,
  extracao,
  createdAtLabel,
  paymentOptions,
  suggestedPaymentId,
}: {
  id: string;
  imageDataUri: string;
  senderLabel: string;
  memberName: string | null;
  motivoLabel: string;
  extracao: { valor: string | null; dataHora: string | null; pagador: string | null; instituicao: string | null; confianca: string | null };
  createdAtLabel: string;
  paymentOptions: PaymentOption[];
  suggestedPaymentId: string | null;
}) {
  const [paymentId, setPaymentId] = useState(suggestedPaymentId ?? "");
  const [pending, startTransition] = useTransition();
  const isPdf = imageDataUri.startsWith("data:application/pdf") || imageDataUri.endsWith(".pdf");
  const comprovanteUrl = `/api/financeiro/comprovante?kind=whatsapp&id=${id}`;

  function handle(action: "aprovar" | "rejeitar") {
    startTransition(async () => {
      const res =
        action === "aprovar"
          ? await aprovarComprovante(id, paymentId)
          : await rejeitarComprovante(id);
      if (res.ok) toast.success(action === "aprovar" ? "Baixa registrada! O associado foi avisado." : "Comprovante rejeitado. O remetente foi avisado.");
      else toast.error(res.error ?? "Erro.");
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{memberName ?? senderLabel}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{createdAtLabel}</Badge>
            <Badge variant="secondary">{motivoLabel}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[200px_1fr]">
        {isPdf ? (
          <object
            data={comprovanteUrl}
            type="application/pdf"
            className="h-64 w-full rounded-md border"
            aria-label="Comprovante em PDF"
          >
            <p className="p-3 text-xs text-muted-foreground">
              Comprovante em PDF — visualize pelo leitor do navegador.
            </p>
          </object>
        ) : (
          <a href={comprovanteUrl} target="_blank" rel="noreferrer" title="Abrir em tamanho real">
            <img
              src={comprovanteUrl}
              alt="Comprovante"
              className="max-h-64 w-full rounded-md border object-contain"
            />
          </a>
        )}
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-muted-foreground">Remetente</span>
            <span>{senderLabel}</span>
            <span className="text-muted-foreground">Valor lido</span>
            <span>{extracao.valor ?? "—"}</span>
            <span className="text-muted-foreground">Data no comprovante</span>
            <span>{extracao.dataHora ?? "—"}</span>
            <span className="text-muted-foreground">Pagador</span>
            <span>{extracao.pagador ?? "—"}</span>
            <span className="text-muted-foreground">Instituição</span>
            <span>{extracao.instituicao ?? "—"}</span>
            <span className="text-muted-foreground">Confiança da leitura</span>
            <span>{extracao.confianca ?? "—"}</span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Vincular à cobrança</label>
            <select
              value={paymentId}
              onChange={(e) => setPaymentId(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none"
            >
              <option value="">Selecione a cobrança…</option>
              {paymentOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => handle("aprovar")} disabled={pending || !paymentId}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Aprovar e dar baixa
            </Button>
            <Button size="sm" variant="outline" onClick={() => handle("rejeitar")} disabled={pending}>
              <X className="size-4" /> Rejeitar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

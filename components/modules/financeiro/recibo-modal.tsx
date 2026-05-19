"use client";

import { useRef, useState } from "react";
import { Mountain, ShieldCheck, Printer, Download, X } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { formatCpf } from "@/lib/cpf";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  paymentId: string;
  memberName: string;
  memberCpf: string;
  planName: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  receiptNumber: string | null;
  notes: string | null;
};

function toAmountWords(value: number): string {
  const inteiros = Math.round(value);
  const words: Record<number, string> = {
    1: "um", 2: "dois", 3: "três", 4: "quatro", 5: "cinco",
    6: "seis", 7: "sete", 8: "oito", 9: "nove", 10: "dez",
    11: "onze", 12: "doze", 13: "treze", 14: "quatorze", 15: "quinze",
    16: "dezesseis", 17: "dezessete", 18: "dezoito", 19: "dezenove",
    20: "vinte", 30: "trinta", 40: "quarenta", 50: "cinquenta",
    60: "sessenta", 70: "setenta", 80: "oitenta", 90: "noventa",
    100: "cem",
  };
  if (words[inteiros]) return `${words[inteiros]} reais`;
  if (inteiros > 100) {
    const cents = Math.floor(inteiros / 100) * 100;
    const rest = inteiros % 100;
    const centLabel = cents === 100 ? "cento" : words[cents] ?? String(cents);
    return rest ? `${centLabel} e ${words[rest] ?? rest} reais` : `${centLabel} reais`;
  }
  const tens = Math.floor(inteiros / 10) * 10;
  const units = inteiros % 10;
  return `${words[tens]} e ${words[units]} reais`;
}

export function ReciboModal({
  open,
  onClose,
  paymentId,
  memberName,
  memberCpf,
  planName,
  amount,
  dueDate,
  paidAt,
  receiptNumber,
  notes,
}: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const recNum = receiptNumber ?? `${new Date().getFullYear()}-????`;
  const paidDate = paidAt ? new Date(paidAt) : new Date();
  const dueObj = new Date(dueDate);
  const amountWords = toAmountWords(amount);
  const isEnrollment = notes === "Taxa de inscrição";
  const descricao = isEnrollment
    ? "Taxa de Inscrição (cobrança única)"
    : `mensalidade do plano ${planName}`;

  function handlePrint() {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Recibo ${recNum}</title>
<style>
  body { font-family: Georgia, serif; margin: 0; padding: 40px; color: #111; }
  .receipt { border: 2px solid #166534; border-radius: 8px; padding: 32px; max-width: 600px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 24px; }
  .club-name { font-size: 20px; font-weight: bold; margin: 8px 0 4px; }
  .sub { font-size: 12px; color: #555; }
  .recibo-num { font-size: 13px; font-weight: bold; letter-spacing: 0.1em; margin-top: 4px; }
  hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
  .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
  .body-text { font-size: 14px; line-height: 1.7; margin: 16px 0; text-align: justify; }
  .amount-big { text-align: center; font-size: 28px; font-weight: bold; color: #166534; margin: 20px 0; }
  .disclaimer { font-size: 12px; color: #444; line-height: 1.6; text-align: justify; }
  .sig { margin-top: 48px; border-top: 1px solid #888; padding-top: 6px; text-align: center; font-size: 12px; color: #555; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="receipt">
  <div class="header">
    <div style="font-size:28px;">▲</div>
    <div class="club-name">Centro Excursionista Friburguense</div>
    <div class="sub">Sistema de Mensalidades — "Conquistar"</div>
    <div class="recibo-num">RECIBO Nº ${recNum}</div>
  </div>
  <hr/>
  <div class="row"><span><b>Emitido em:</b> ${formatDate(new Date())}</span><span><b>Valor:</b> ${formatBRL(amount)}</span></div>
  <div class="body-text">
    Recebemos de <b>${memberName}</b>, CPF <b>${formatCpf(memberCpf)}</b>, a importância de
    <b>${formatBRL(amount)}</b> (${amountWords}), referente à
    <b>${descricao}</b>, com vencimento em <b>${formatDate(dueObj)}</b>,
    pago em <b>${formatDate(paidDate)}</b>.
  </div>
  <div class="amount-big">${formatBRL(amount)}</div>
  <div class="disclaimer">
    Para clareza e validade, firmamos o presente recibo, dando plena, geral e irrevogável quitação do valor acima descrito.
  </div>
  <div class="sig">Centro Excursionista Friburguense — Tesouraria</div>
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
    win.document.close();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pré-visualização do Recibo</DialogTitle>
          <DialogDescription>
            Confira os dados abaixo antes de imprimir ou baixar em PDF.
          </DialogDescription>
        </DialogHeader>

        {/* Confira os dados */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400">
            <ShieldCheck className="size-4" /> Confira os dados
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            <div>
              <span className="text-muted-foreground">Nome: </span>
              <span className="font-semibold">{memberName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">CPF: </span>
              <span className="font-semibold">{formatCpf(memberCpf)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Plano: </span>
              <span className="font-semibold">{planName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Recibo Nº: </span>
              <span className="font-semibold">{recNum}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Vencimento: </span>
              <span className="font-semibold">{formatDate(dueObj)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Pago em: </span>
              <span className="font-semibold">{formatDate(paidDate)}</span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">Valor: </span>
              <span className="font-bold text-green-700 dark:text-green-400">
                {formatBRL(amount)}
              </span>
            </div>
          </div>
        </div>

        {/* Prévia do recibo */}
        <div
          ref={printRef}
          className="rounded-lg border-2 border-green-700/40 bg-white p-6 text-gray-900 dark:bg-white"
        >
          {/* Cabeçalho */}
          <div className="mb-5 text-center">
            <Mountain className="mx-auto mb-1 size-7 text-green-700" />
            <p className="text-lg font-bold">Centro Excursionista Friburguense</p>
            <p className="text-xs text-gray-500">
              Sistema de Mensalidades — &ldquo;Conquistar&rdquo;
            </p>
            <p className="mt-0.5 text-xs font-bold uppercase tracking-widest text-gray-700">
              Recibo Nº {recNum}
            </p>
          </div>

          <hr className="border-gray-300" />

          <div className="my-3 flex justify-between text-sm">
            <span>
              <span className="font-semibold">Emitido em:</span>{" "}
              {formatDate(new Date())}
            </span>
            <span>
              <span className="font-semibold">Valor:</span> {formatBRL(amount)}
            </span>
          </div>

          <p className="text-sm leading-relaxed text-justify">
            Recebemos de{" "}
            <strong>{memberName}</strong>, CPF{" "}
            <strong>{formatCpf(memberCpf)}</strong>, a importância de{" "}
            <strong>{formatBRL(amount)}</strong> ({amountWords}), referente à{" "}
            <strong>{descricao}</strong>, com vencimento em{" "}
            <strong>{formatDate(dueObj)}</strong>, pago em{" "}
            <strong>{formatDate(paidDate)}</strong>.
          </p>

          <p className="my-4 text-center text-2xl font-bold text-green-700">
            {formatBRL(amount)}
          </p>

          <p className="text-xs leading-relaxed text-gray-500 text-justify">
            Para clareza e validade, firmamos o presente recibo, dando plena,
            geral e irrevogável quitação do valor acima descrito.
          </p>

          <div className="mt-10 border-t border-gray-400 pt-1.5 text-center text-xs text-gray-500">
            Centro Excursionista Friburguense — Tesouraria
          </div>
        </div>

        {/* Checkbox de confirmação */}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 size-4 accent-green-700"
          />
          <span>
            Confirmo que conferi o <strong>nome</strong>,{" "}
            <strong>CPF</strong> e <strong>valor</strong> do recibo.
          </span>
        </label>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <Button
            variant="outline"
            disabled={!confirmed}
            onClick={handlePrint}
          >
            <Download className="size-4" /> Baixar PDF
          </Button>
          <Button disabled={!confirmed} onClick={handlePrint}>
            <Printer className="size-4" /> Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

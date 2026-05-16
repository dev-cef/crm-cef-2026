"use client";

import Image from "next/image";
import { Download, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CefLogo } from "@/components/layout/cef-logo";

type Props = {
  fullName: string;
  maskedCpf: string;
  membershipNo: string;
  planName: string;
  validity: string;
  photoUrl: string | null;
  qrDataUrl: string;
  validationUrl: string;
};

export function MembershipCard(props: Props) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(props.validationUrl);
      toast.success("Link de validação copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Carteirinha CEF",
          text: `Carteirinha de ${props.fullName}`,
          url: props.validationUrl,
        });
      } catch {
        /* cancelado */
      }
    } else {
      copyLink();
    }
  }

  return (
    <div className="space-y-4">
      <div className="print-area mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex items-center gap-2.5 bg-primary px-5 py-3 text-primary-foreground">
            <span className="flex size-8 items-center justify-center rounded-md bg-white p-1">
              <CefLogo className="size-full" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold">
                Centro Excursionista Friburguense
              </p>
              <p className="text-[10px] opacity-80">Carteirinha de Sócio</p>
            </div>
          </div>

          <div className="flex gap-4 p-5">
            <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
              {props.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={props.photoUrl}
                  alt={props.fullName}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-2xl font-semibold text-muted-foreground">
                  {props.fullName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1 text-zinc-900">
              <div>
                <p className="text-[10px] uppercase text-zinc-500">Nome</p>
                <p className="truncate text-sm font-semibold">
                  {props.fullName}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">CPF</p>
                  <p className="font-mono text-xs">{props.maskedCpf}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">
                    Matrícula
                  </p>
                  <p className="font-mono text-xs">{props.membershipNo}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">Plano</p>
                  <p className="text-xs">{props.planName}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-zinc-500">
                    Validade
                  </p>
                  <p className="text-xs">{props.validity}</p>
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <Image
                src={props.qrDataUrl}
                alt="QR Code de validação"
                width={84}
                height={84}
                unoptimized
                className="rounded"
              />
            </div>
          </div>

          <div className="border-t bg-zinc-50 px-5 py-2 text-center text-[10px] text-zinc-500">
            Aponte a câmera para o QR Code para validar este associado.
          </div>
        </div>
      </div>

      <div className="no-print flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.print()} size="sm">
          <Download className="size-4" /> Baixar PDF
        </Button>
        <Button onClick={copyLink} variant="outline" size="sm">
          <Link2 className="size-4" /> Copiar link
        </Button>
        <Button onClick={share} variant="outline" size="sm">
          <Share2 className="size-4" /> Compartilhar
        </Button>
      </div>
    </div>
  );
}

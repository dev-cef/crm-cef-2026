"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Save = (enabled: boolean) => Promise<{ ok: boolean; error?: string }>;

export function AutoBaixaCard({
  initialEnabled,
  save,
}: {
  initialEnabled: boolean;
  save: Save;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const res = await save(next);
      if (res.ok) {
        toast.success(next ? "Baixa automática ativada!" : "Baixa automática desativada — voltou ao modo sombra.");
      } else {
        setEnabled(!next);
        toast.error(res.error ?? "Erro ao salvar.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="size-4" /> Baixa automática por IA
        </CardTitle>
        <CardDescription>
          Quando um comprovante recebido pelo WhatsApp bate exatamente com uma pendência (sócio
          identificado, valor certo, confiança alta), a baixa acontece sem esperar confirmação
          humana. Casos ambíguos sempre caem em revisão manual, independente deste toggle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Checkbox checked={enabled} onCheckedChange={(v) => handleChange(Boolean(v))} />
          )}
          {enabled ? "Ativada — baixa direto quando o comprovante é inequívoco" : "Desativada — modo sombra (sempre pede baixa/rejeitar no grupo)"}
        </label>
      </CardContent>
    </Card>
  );
}

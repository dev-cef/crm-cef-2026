"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Save = (enabled: boolean, allowlistRaw: string) => Promise<{ ok: boolean; error?: string }>;

export function WhatsappBaixaCard({
  initialEnabled,
  initialAllowlist,
  save,
}: {
  initialEnabled: boolean;
  initialAllowlist: string;
  save: Save;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [allowlist, setAllowlist] = useState(initialAllowlist);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const res = await save(enabled, allowlist);
      if (res.ok) toast.success("Configuração de baixa salva!");
      else toast.error(res.error ?? "Erro ao salvar.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" /> Baixa por WhatsApp
        </CardTitle>
        <CardDescription>
          Um membro autorizado responde a notificação do comprovante no grupo Financeiro com{" "}
          <code>baixa</code> e o pagamento é confirmado automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
          Permitir baixa respondendo no grupo Financeiro
        </label>
        <div>
          <label className="text-sm font-medium">Números autorizados</label>
          <Textarea
            rows={4}
            value={allowlist}
            onChange={(e) => setAllowlist(e.target.value)}
            placeholder={"22999998888\n22988887777"}
            className="mt-1 font-mono text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Um número por linha (com DDD). Só estes números conseguem dar baixa pelo WhatsApp.
            Deixe vazio e desmarque acima para desativar.
          </p>
        </div>
        <Button onClick={handleSave} disabled={pending} size="sm">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

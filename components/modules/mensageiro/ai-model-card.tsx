"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Save, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Dados do registro passados pelo server (não importamos lib/comprovante-ai
// aqui: ela carrega os SDKs dos provedores, que não devem ir pro bundle client).
export type ProviderOption = {
  id: string;
  label: string;
  configured: boolean;
  models: { id: string; label: string; note?: string }[];
};

type Save = (provider: string, model: string) => Promise<{ ok: boolean; error?: string }>;

export function AiModelCard({
  initialProvider,
  initialModel,
  providers,
  save,
}: {
  initialProvider: string;
  initialModel: string;
  providers: ProviderOption[];
  save: Save;
}) {
  const [provider, setProvider] = useState(initialProvider);
  const [model, setModel] = useState(initialModel);
  const [pending, startTransition] = useTransition();

  const current = useMemo(
    () => providers.find((p) => p.id === provider) ?? providers[0],
    [providers, provider],
  );
  const configured = current?.configured ?? false;
  const dirty = provider !== initialProvider || model !== initialModel;

  function handleProviderChange(next: string) {
    setProvider(next);
    // Ao trocar de provedor, escolhe o primeiro modelo dele (o anterior não vale).
    const p = providers.find((x) => x.id === next);
    if (p && !p.models.some((m) => m.id === model)) {
      setModel(p.models[0]?.id ?? "");
    }
  }

  function handleSave() {
    startTransition(async () => {
      const res = await save(provider, model);
      if (res.ok) toast.success("Modelo de IA salvo!");
      else toast.error(res.error ?? "Erro ao salvar.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" /> Modelo de IA
        </CardTitle>
        <CardDescription>
          Provedor e modelo usados para ler os comprovantes recebidos pelo WhatsApp e extrair
          valor, pagador e ID da transação. Escolha aqui sem mexer no código — útil pra comparar
          precisão e custo entre modelos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-provider">Provedor</Label>
            <Select value={provider} onValueChange={(v) => handleProviderChange(String(v))}>
              <SelectTrigger id="ai-provider" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                    {!p.configured ? " · sem chave" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-model">Modelo</Label>
            <Select value={model} onValueChange={(v) => setModel(String(v))}>
              <SelectTrigger id="ai-model" className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(current?.models ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                    {m.note ? ` · ${m.note}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!configured && (
          <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
            <span>
              Este provedor ainda não tem chave de API configurada no servidor. Enquanto isso, os
              comprovantes caem na fila de revisão manual (Financeiro &gt; Comprovantes). Defina a
              variável de ambiente do provedor no Vercel para ativá-lo.
            </span>
          </div>
        )}

        <Button onClick={handleSave} disabled={pending || !dirty} size="sm">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

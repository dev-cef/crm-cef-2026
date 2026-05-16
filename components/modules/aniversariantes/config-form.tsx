"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { saveBirthdayConfig } from "@/app/(app)/aniversariantes/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function ConfigForm({
  initialTemplate,
  initialEnabled,
}: {
  initialTemplate: string;
  initialEnabled: boolean;
}) {
  const [template, setTemplate] = useState(initialTemplate);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await saveBirthdayConfig(template, enabled);
      if (res.ok) toast.success("Configuração salva!");
      else toast.error(res.error ?? "Erro ao salvar.");
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="tpl">Texto da mensagem</Label>
        <Textarea
          id="tpl"
          rows={3}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="mt-1"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use <code>{"{nome}"}</code> para o primeiro nome ou{" "}
          <code>{"{nomeCompleto}"}</code> para o nome completo.
        </p>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={enabled}
          onCheckedChange={(v) => setEnabled(Boolean(v))}
        />
        Envio automático de aniversário ativado
      </label>
      <Button onClick={save} disabled={pending} size="sm">
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        Salvar configuração
      </Button>
    </div>
  );
}

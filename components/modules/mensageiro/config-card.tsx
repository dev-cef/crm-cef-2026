"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SaveAction = (template: string, enabled: boolean) => Promise<{ ok: boolean; error?: string }>;

export function ConfigCard({
  title,
  description,
  enabledLabel,
  placeholders,
  initialTemplate,
  initialEnabled,
  save,
}: {
  title: string;
  description: string;
  enabledLabel: string;
  placeholders: React.ReactNode;
  initialTemplate: string;
  initialEnabled: boolean;
  save: SaveAction;
}) {
  const [template, setTemplate] = useState(initialTemplate);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const id = title.toLowerCase().replace(/\s+/g, "-");

  function handleSave() {
    startTransition(async () => {
      const res = await save(template, enabled);
      if (res.ok) toast.success("Configuração salva!");
      else toast.error(res.error ?? "Erro ao salvar.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor={id}>Texto da mensagem</Label>
          <Textarea
            id={id}
            rows={4}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">{placeholders}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
          {enabledLabel}
        </label>
        <Button onClick={handleSave} disabled={pending} size="sm">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

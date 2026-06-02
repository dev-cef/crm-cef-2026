"use client";

import { useState, useTransition } from "react";
import { FileText, Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { saveRelatorio } from "@/app/(app)/eventos/actions";

interface EventRelatorioProps {
  eventId: string;
  relatorio: string | null;
  canEdit: boolean;
}

export function EventRelatorio({ eventId, relatorio, canEdit }: EventRelatorioProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(relatorio ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const res = await saveRelatorio(eventId, text);
      if (res.ok) {
        toast.success("Relatório salvo.");
        setEditing(false);
      } else {
        toast.error(res.error ?? "Erro ao salvar.");
      }
    });
  }

  function handleCancel() {
    setText(relatorio ?? "");
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="space-y-3">
        {relatorio ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{relatorio}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Nenhum relatório registrado.
          </p>
        )}
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3.5" />
            {relatorio ? "Editar relatório" : "Adicionar relatório"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Descreva como foi a excursão: condições do terreno, dificuldades, destaques, participação da turma..."
        rows={8}
        className="resize-y text-sm"
        autoFocus
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isPending}
        >
          <Check className="size-3.5" />
          Salvar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={isPending}
        >
          <X className="size-3.5" />
          Cancelar
        </Button>
      </div>
    </div>
  );
}

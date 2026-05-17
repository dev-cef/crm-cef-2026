"use client";

import { useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCardSettings } from "@/app/(app)/carteirinha/actions";

export function CardSettingsForm({
  memberId,
  registration,
  cardValidUntil,
}: {
  memberId: string;
  registration: number;
  cardValidUntil: string | null; // ISO date or null
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reg, setReg] = useState(String(registration));
  const [validity, setValidity] = useState(cardValidUntil?.slice(0, 10) ?? "");

  async function handleSave() {
    const regNum = parseInt(reg, 10);
    if (!regNum || regNum < 1) {
      toast.error("Número de matrícula inválido.");
      return;
    }
    setSaving(true);
    const res = await updateCardSettings(memberId, regNum, validity || null);
    setSaving(false);
    if (res.ok) {
      toast.success("Carteirinha atualizada.");
      setOpen(false);
    } else {
      toast.error(res.error ?? "Erro ao salvar.");
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Editar matrícula e validade
      </Button>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl border bg-card p-4 shadow-sm">
      <p className="mb-4 text-sm font-semibold">Editar carteirinha</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="registration">Número de matrícula</Label>
          <Input
            id="registration"
            type="number"
            min={1}
            value={reg}
            onChange={(e) => setReg(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="validity">
            Data de vencimento
            <span className="ml-1 text-xs text-muted-foreground">(vazio = 31/12/{new Date().getFullYear()})</span>
          </Label>
          <Input
            id="validity"
            type="date"
            value={validity}
            onChange={(e) => setValidity(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
          <X className="size-4" /> Cancelar
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="size-4" /> {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

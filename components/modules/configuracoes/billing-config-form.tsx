"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  saveBillingConfig,
  type BillingConfigValues,
} from "@/app/(app)/financeiro/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PIX_KEY_TYPES = [
  { value: "CPF", label: "CPF" },
  { value: "CNPJ", label: "CNPJ" },
  { value: "EMAIL", label: "E-mail" },
  { value: "TELEFONE", label: "Telefone" },
  { value: "ALEATORIA", label: "Chave aleatória" },
];

export function BillingConfigForm({
  initialValues,
  whatsappConfigured,
}: {
  initialValues: BillingConfigValues;
  whatsappConfigured: boolean;
}) {
  const [values, setValues] = useState(initialValues);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof BillingConfigValues>(key: K, value: BillingConfigValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const res = await saveBillingConfig(values);
      if (res.ok) toast.success("Dados de cobrança salvos!");
      else toast.error(res.error ?? "Erro ao salvar.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pixKey">Chave PIX</Label>
          <Input
            id="pixKey"
            value={values.pixKey}
            onChange={(e) => set("pixKey", e.target.value)}
            placeholder="00.000.000/0001-00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pixKeyType">Tipo da chave</Label>
          <Select value={values.pixKeyType} onValueChange={(v) => set("pixKeyType", v ?? "")}>
            <SelectTrigger id="pixKeyType"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PIX_KEY_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="accountHolderName">Titular</Label>
          <Input
            id="accountHolderName"
            value={values.accountHolderName}
            onChange={(e) => set("accountHolderName", e.target.value)}
            placeholder="Clube Excursionista de Friburgo"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pixCity">Cidade do titular</Label>
          <Input
            id="pixCity"
            value={values.pixCity}
            onChange={(e) => set("pixCity", e.target.value)}
            placeholder="Nova Friburgo"
          />
          <p className="text-xs text-muted-foreground">
            Exigida pelo padrão do PIX para gerar o QR Code corretamente.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="bankName">Banco (opcional)</Label>
          <Input
            id="bankName"
            value={values.bankName}
            onChange={(e) => set("bankName", e.target.value)}
            placeholder="Banco do Brasil"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bankAgency">Agência</Label>
          <Input
            id="bankAgency"
            value={values.bankAgency}
            onChange={(e) => set("bankAgency", e.target.value)}
            placeholder="0000-0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bankAccount">Conta</Label>
          <Input
            id="bankAccount"
            value={values.bankAccount}
            onChange={(e) => set("bankAccount", e.target.value)}
            placeholder="00000-0"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="financeiroWhatsapp">WhatsApp do financeiro</Label>
        <Input
          id="financeiroWhatsapp"
          value={values.financeiroWhatsapp}
          onChange={(e) => set("financeiroWhatsapp", e.target.value)}
          placeholder="22999999999 ou 120363xxxxxxxxxx@g.us"
        />
        <p className="text-xs text-muted-foreground">
          Número com DDD (ex: 22999999999) ou JID de um grupo (termina em <code>@g.us</code>).
          Recebe um aviso via WhatsApp sempre que um associado enviar um comprovante de pagamento.
        </p>
      </div>

      {!whatsappConfigured && (
        <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            A integração de WhatsApp (Evolution API) não está configurada no servidor. Os
            comprovantes serão salvos normalmente, mas o aviso ao financeiro não será enviado
            até que <code>EVOLUTION_API_URL</code>, <code>EVOLUTION_API_KEY</code> e{" "}
            <code>EVOLUTION_INSTANCE</code> sejam definidos.
          </span>
        </div>
      )}

      <Button onClick={save} disabled={pending} size="sm">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Salvar dados de cobrança
      </Button>
    </div>
  );
}

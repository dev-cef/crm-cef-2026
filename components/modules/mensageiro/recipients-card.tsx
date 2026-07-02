"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SaveRecipients = (values: {
  defaultPhone: string;
  financeGroupJid: string;
  secretariaGroupJid: string;
}) => Promise<{ ok: boolean; error?: string }>;

export function RecipientsCard({
  initialDefaultPhone,
  initialFinanceGroupJid,
  initialSecretariaGroupJid,
  save,
}: {
  initialDefaultPhone: string;
  initialFinanceGroupJid: string;
  initialSecretariaGroupJid: string;
  save: SaveRecipients;
}) {
  const [defaultPhone, setDefaultPhone] = useState(initialDefaultPhone);
  const [financeGroupJid, setFinanceGroupJid] = useState(initialFinanceGroupJid);
  const [secretariaGroupJid, setSecretariaGroupJid] = useState(initialSecretariaGroupJid);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const res = await save({ defaultPhone, financeGroupJid, secretariaGroupJid });
      if (res.ok) toast.success("Destinatários salvos!");
      else toast.error(res.error ?? "Erro ao salvar.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" /> Destinatários
        </CardTitle>
        <CardDescription>
          Para onde as notificações do clube são enviadas por WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="defaultPhone" className="flex items-center gap-1.5">
            <Phone className="size-3.5" /> Telefone padrão do clube
          </Label>
          <Input
            id="defaultPhone"
            value={defaultPhone}
            onChange={(e) => setDefaultPhone(e.target.value)}
            placeholder="22996194503"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Número com DDD. Usado como destino/fallback das notificações do clube.
          </p>
        </div>

        <div>
          <Label htmlFor="financeGroupJid">Grupo do Financeiro</Label>
          <Input
            id="financeGroupJid"
            value={financeGroupJid}
            onChange={(e) => setFinanceGroupJid(e.target.value)}
            placeholder="120xxxxxxxxxxxxxxx@g.us"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            JID do grupo (<code>…@g.us</code>) que recebe comprovantes e pagamentos.
            Preenchido após adicionar o WhatsApp do clube ao grupo.
          </p>
        </div>

        <div>
          <Label htmlFor="secretariaGroupJid">Grupo da Secretaria</Label>
          <Input
            id="secretariaGroupJid"
            value={secretariaGroupJid}
            onChange={(e) => setSecretariaGroupJid(e.target.value)}
            placeholder="120xxxxxxxxxxxxxxx@g.us"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            JID do grupo que recebe novo associado e solicitação de carteirinha.
          </p>
        </div>
      </CardContent>
      <CardContent className="pt-0">
        <Button onClick={handleSave} disabled={pending} size="sm">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}

import { MessagesSquare, TriangleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { evolutionConfigured } from "@/lib/whatsapp";
import { getMessengerConfig } from "@/lib/messenger";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfigCard } from "@/components/modules/mensageiro/config-card";
import { RecipientsCard } from "@/components/modules/mensageiro/recipients-card";
import { WhatsappBaixaCard } from "@/components/modules/mensageiro/whatsapp-baixa-card";
import { AutoBaixaCard } from "@/components/modules/mensageiro/auto-baixa-card";
import { AiModelCard } from "@/components/modules/mensageiro/ai-model-card";
import { LogFilter } from "@/components/modules/mensageiro/log-filter";
import { AI_PROVIDERS, configuredProviders } from "@/lib/comprovante-ai";
import {
  saveBirthdayTemplate,
  saveReceiptTemplate,
  savePaymentTemplate,
  saveNewMemberTemplate,
  saveCardRequestTemplate,
  saveRecipients,
  saveWhatsappBaixa,
  saveAutoBaixa,
  saveAiModel,
} from "@/app/(app)/mensageiro/actions";

function parseAllowlist(json: string): string {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.join("\n") : "";
  } catch {
    return "";
  }
}

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  ANIVERSARIO: "Aniversário",
  COMPROVANTE_RECEBIDO: "Comprovante recebido",
  PAGAMENTO_CONFIRMADO: "Pagamento confirmado",
  NOVO_ASSOCIADO: "Novo associado",
  CARTEIRINHA: "Carteirinha",
};

const VALID_TYPES = [
  "ANIVERSARIO",
  "COMPROVANTE_RECEBIDO",
  "PAGAMENTO_CONFIRMADO",
  "NOVO_ASSOCIADO",
  "CARTEIRINHA",
];

export default async function MensageiroPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await auth();
  const sessionUser = toSessionUser(session!.user);
  const canEdit = await can(sessionUser, "mensageiro", "edit");

  const sp = await searchParams;
  const typeFilter = VALID_TYPES.includes(sp.type ?? "") ? sp.type! : "ALL";

  const [cfg, logs] = await Promise.all([
    getMessengerConfig(),
    prisma.messageLog.findMany({
      where: typeFilter === "ALL" ? undefined : { type: typeFilter },
      orderBy: { sentAt: "desc" },
      take: 50,
      include: { member: { select: { fullName: true } } },
    }),
  ]);

  const whatsappOk = evolutionConfigured();

  // Registro de provedores + quais têm chave configurada (serializável p/ o client).
  const configured = new Set(configuredProviders());
  const aiProviders = AI_PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    configured: configured.has(p.id),
    models: p.models.map((m) => ({ id: m.id, label: m.label, note: m.note })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mensageiro"
        description="Modelos de mensagem e histórico de notificações enviadas por WhatsApp e e-mail."
      />

      {!whatsappOk && (
        <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            A integração de WhatsApp (Evolution API) não está configurada no servidor. As
            mensagens não serão enviadas até que <code>EVOLUTION_API_URL</code>,{" "}
            <code>EVOLUTION_API_KEY</code> e <code>EVOLUTION_INSTANCE</code> sejam definidos —
            mas as tentativas continuam registradas no histórico abaixo.
          </span>
        </div>
      )}

      {canEdit && (
        <RecipientsCard
          initialDefaultPhone={cfg.defaultPhone ?? ""}
          initialFinanceGroupJid={cfg.financeGroupJid ?? ""}
          initialSecretariaGroupJid={cfg.secretariaGroupJid ?? ""}
          save={saveRecipients}
        />
      )}

      {canEdit && (
        <WhatsappBaixaCard
          initialEnabled={cfg.whatsappBaixaEnabled}
          initialAllowlist={parseAllowlist(cfg.whatsappBaixaAllowlist)}
          save={saveWhatsappBaixa}
        />
      )}

      {canEdit && <AutoBaixaCard initialEnabled={cfg.autoBaixaEnabled} save={saveAutoBaixa} />}

      {canEdit && (
        <AiModelCard
          initialProvider={cfg.aiProvider}
          initialModel={cfg.aiModel}
          providers={aiProviders}
          save={saveAiModel}
        />
      )}

      {canEdit && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ConfigCard
            title="Aniversário"
            description="Enviado ao associado no dia do aniversário."
            enabledLabel="Envio automático ativado"
            placeholders={
              <>
                Use <code>{"{nome}"}</code> (primeiro nome) ou{" "}
                <code>{"{nomeCompleto}"}</code>.
              </>
            }
            initialTemplate={cfg.template}
            initialEnabled={cfg.enabled}
            save={saveBirthdayTemplate}
          />
          <ConfigCard
            title="Comprovante recebido"
            description="Aviso ao financeiro quando um associado envia um comprovante."
            enabledLabel="Aviso ativado"
            placeholders={
              <>
                Use <code>{"{associado}"}</code>, <code>{"{referencia}"}</code> e{" "}
                <code>{"{valor}"}</code>.
              </>
            }
            initialTemplate={cfg.receiptTemplate}
            initialEnabled={cfg.receiptEnabled}
            save={saveReceiptTemplate}
          />
          <ConfigCard
            title="Pagamento confirmado"
            description="Aviso ao associado quando uma cobrança é dada como paga."
            enabledLabel="Aviso ativado"
            placeholders={
              <>
                Use <code>{"{nome}"}</code>, <code>{"{referencia}"}</code>,{" "}
                <code>{"{valor}"}</code> e <code>{"{recibo}"}</code>.
              </>
            }
            initialTemplate={cfg.paymentTemplate}
            initialEnabled={cfg.paymentEnabled}
            save={savePaymentTemplate}
          />
          <ConfigCard
            title="Novo associado"
            description="Aviso à secretaria quando alguém se auto-cadastra (antes da aprovação)."
            enabledLabel="Aviso ativado"
            placeholders={
              <>
                Use <code>{"{associado}"}</code>, <code>{"{matricula}"}</code>,{" "}
                <code>{"{telefone}"}</code> e <code>{"{email}"}</code>.
              </>
            }
            initialTemplate={cfg.newMemberTemplate}
            initialEnabled={cfg.newMemberEnabled}
            save={saveNewMemberTemplate}
          />
          <ConfigCard
            title="Carteirinha"
            description="Aviso à secretaria quando uma solicitação de carteirinha física é aberta."
            enabledLabel="Aviso ativado"
            placeholders={
              <>
                Use <code>{"{associado}"}</code> e <code>{"{tipo}"}</code> (1ª/2ª via).
              </>
            }
            initialTemplate={cfg.cardRequestTemplate}
            initialEnabled={cfg.cardRequestEnabled}
            save={saveCardRequestTemplate}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessagesSquare className="size-4" /> Histórico de envios
            </CardTitle>
            <LogFilter type={typeFilter} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Destinatário</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma mensagem registrada ainda.
                  </TableCell>
                </TableRow>
              )}
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Badge variant="outline">{TYPE_LABEL[l.type] ?? l.type}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {l.member?.fullName ?? l.recipient ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{l.channel}</Badge>
                  </TableCell>
                  <TableCell>
                    {l.status === "FALHA" ? (
                      <Badge variant="destructive" title={l.errorMessage ?? undefined}>
                        Falha
                      </Badge>
                    ) : (
                      <Badge variant="default">Enviado</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(l.sentAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

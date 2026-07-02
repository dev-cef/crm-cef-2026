import { requireAdmin } from "@/lib/authz";
import { getSystemConfig } from "@/app/(app)/financeiro/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BillingConfigForm } from "@/components/modules/configuracoes/billing-config-form";
import { evolutionConfigured } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function CobrancaConfigPage() {
  await requireAdmin();
  const cfg = await getSystemConfig();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cobrança"
        description="Dados de PIX e conta bancária exibidos ao associado ao visualizar uma cobrança, e o contato do financeiro avisado quando um comprovante é enviado."
      />
      <Card>
        <CardHeader>
          <CardTitle>Dados de recebimento</CardTitle>
          <CardDescription>
            Exibidos em &quot;Meu Espaço&quot; sempre que houver uma cobrança em aberto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BillingConfigForm
            initialValues={{
              pixKey: cfg.pixKey ?? "",
              pixKeyType: cfg.pixKeyType ?? "CPF",
              pixCity: cfg.pixCity ?? "",
              bankName: cfg.bankName ?? "",
              bankAgency: cfg.bankAgency ?? "",
              bankAccount: cfg.bankAccount ?? "",
              accountHolderName: cfg.accountHolderName ?? "",
              financeiroWhatsapp: cfg.financeiroWhatsapp ?? "",
            }}
            whatsappConfigured={evolutionConfigured()}
          />
        </CardContent>
      </Card>
    </div>
  );
}

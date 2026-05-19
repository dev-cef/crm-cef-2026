import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TotpSetup } from "@/components/modules/configuracoes/totp-setup";

export const dynamic = "force-dynamic";

export default async function SegurancaPage() {
  const user = await requireAdmin();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpEnabled: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Segurança" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Verificação em duas etapas (2FA)</CardTitle>
          <CardDescription>
            Protege o acesso de administrador com um código temporário (TOTP)
            de um app autenticador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TotpSetup enabled={dbUser?.totpEnabled ?? false} />
        </CardContent>
      </Card>
    </div>
  );
}

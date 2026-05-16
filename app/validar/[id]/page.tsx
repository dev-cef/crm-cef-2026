import { CheckCircle2, XCircle } from "lucide-react";
import { CefLogo } from "@/components/layout/cef-logo";
import { prisma } from "@/lib/prisma";
import { maskCpf } from "@/lib/cpf";
import { formatDate } from "@/lib/format";
import { membershipNumber, membershipValidity } from "@/lib/membership";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Validação de associado — CEF",
};

export default async function ValidarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const member = await prisma.member.findFirst({
    where: { id, deletedAt: null },
    include: { plan: true },
  });

  const valid = !!member && member.status === "ACTIVE";

  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="cef-aurora pointer-events-none absolute inset-0 -z-10"
      />
      <div className="cef-rise w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <CefLogo className="size-16" />
          <p className="text-sm font-semibold">
            Clube Excursionista de Friburgo
          </p>
          <p className="text-xs text-muted-foreground">
            Validação de associado
          </p>
        </div>

        <Card>
          <CardContent className="space-y-4 py-6">
            {!member ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <XCircle className="size-10 text-destructive" />
                <p className="font-medium">Associado não encontrado</p>
                <p className="text-sm text-muted-foreground">
                  Esta carteirinha não corresponde a um associado válido.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Avatar className="size-14">
                    {member.photoUrl && (
                      <AvatarImage src={member.photoUrl} alt={member.fullName} />
                    )}
                    <AvatarFallback>
                      {member.fullName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {member.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {membershipNumber(member.registration)}
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                    valid
                      ? "bg-primary/10 text-primary"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {valid ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <XCircle className="size-5" />
                  )}
                  <span className="font-medium">
                    {valid
                      ? "Associado ativo e regular"
                      : "Associado inativo"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">CPF</p>
                    <p className="font-mono">{maskCpf(member.cpf)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Plano</p>
                    <p>{member.plan?.name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge
                      variant={valid ? "default" : "secondary"}
                    >
                      {member.status === "ACTIVE" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Validade</p>
                    <p>{formatDate(membershipValidity())}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          CRM CEF 2026 · Validação pública
        </p>
      </div>
    </div>
  );
}

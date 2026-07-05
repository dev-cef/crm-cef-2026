import { redirect } from "next/navigation";
import { VenetianMask } from "lucide-react";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { resolveUserPermissions } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { stopImpersonation } from "@/app/(app)/associados/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const sessionUser = toSessionUser(session.user);
  const permMap = await resolveUserPermissions(sessionUser);

  // Módulos onde canView=false — o menu lateral os omite para este usuário
  const hiddenModules = Object.entries(permMap)
    .filter(([, p]) => !p.view)
    .map(([slug]) => slug);

  const impersonator = session.user.impersonator;

  return (
    <>
      {impersonator && (
        <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm text-amber-950">
          <span className="flex items-center gap-2 font-medium">
            <VenetianMask className="size-4 shrink-0" />
            Você está navegando como <strong>{session.user.name}</strong> (impersonação).
          </span>
          <form action={stopImpersonation}>
            <Button
              type="submit"
              size="sm"
              className="h-7 bg-amber-950 text-amber-50 hover:bg-amber-900"
            >
              Voltar para minha conta{impersonator.name ? ` (${impersonator.name})` : ""}
            </Button>
          </form>
        </div>
      )}
      <AppShell
        user={{
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          expiresAt: session.user.expiresAt,
          totpEnabled: session.user.totpEnabled,
        }}
        hiddenModules={hiddenModules}
      >
        {children}
      </AppShell>
    </>
  );
}

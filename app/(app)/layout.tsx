import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { resolveUserPermissions } from "@/lib/permissions";
import { AppShell } from "@/components/layout/app-shell";

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

  return (
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
  );
}

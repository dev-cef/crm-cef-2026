import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CefLogo } from "@/components/layout/cef-logo";
import { MemberForm } from "@/components/modules/associados/member-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Criar conta — CRM CEF",
};

export default async function CriarContaPage() {
  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <CefLogo className="size-10" />
          <div className="leading-tight">
            <p className="font-display text-lg font-semibold">
              Centro Excursionista Friburguense
            </p>
            <p className="text-xs text-muted-foreground">
              Cadastro de novo associado
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Criar conta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha as 5 etapas do cadastro. Após o envio, sua conta passará
            por aprovação do clube antes de liberar o acesso.
          </p>
          <p className="mt-2 text-sm">
            Já tem conta?{" "}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Entrar
            </Link>
          </p>
        </div>

        <MemberForm mode="signup" plans={plans} />
      </main>
    </div>
  );
}

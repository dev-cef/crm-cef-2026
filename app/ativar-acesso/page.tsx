import Link from "next/link";
import { CefLogo } from "@/components/layout/cef-logo";
import { AtivarAcessoForm } from "./ativar-acesso-form";

export const metadata = {
  title: "Ativar acesso — CRM CEF",
};

export default function AtivarAcessoPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <CefLogo className="size-16" />
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight">
              Centro Excursionista Friburguense
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ativação de acesso para associados
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Ativar meu acesso</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Já é associado do clube? Ative seu acesso ao portal informando
              seu e-mail cadastrado, CPF e criando uma senha.
            </p>
          </div>

          <AtivarAcessoForm />

          <div className="pt-2 space-y-1 text-center text-sm text-muted-foreground">
            <p>
              Já tem acesso?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Entrar
              </Link>
            </p>
            <p>
              Ainda não é associado?{" "}
              <Link href="/criar-conta" className="font-medium text-primary hover:underline">
                Criar conta
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Acesso restrito · CRM CEF 2026
        </p>
      </div>
    </div>
  );
}

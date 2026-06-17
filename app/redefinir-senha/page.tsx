"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, KeyRound, XCircle } from "lucide-react";
import { resetPassword } from "./actions";
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
import { CardBeam } from "@/components/ui/card-beam";
import { CefLogo } from "@/components/layout/cef-logo";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    formData.set("token", token);
    setError(null);
    startTransition(async () => {
      const result = await resetPassword(formData);
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.error ?? "Erro ao redefinir a senha.");
      }
    });
  }

  const invalidToken = !token;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <CefLogo className="size-16" />
          <h1 className="font-display text-xl font-semibold tracking-tight">
            Centro Excursionista Friburguense
          </h1>
        </div>

        <Card className="group cef-rise relative overflow-hidden border-border/70 shadow-xl shadow-primary/5">
          <CardBeam />
          <CardHeader>
            <CardTitle className="font-display text-2xl">
              Nova senha
            </CardTitle>
            <CardDescription>
              Escolha uma senha segura para sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {invalidToken ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <p>
                    Link inválido ou expirado. Solicite um novo link de
                    recuperação.
                  </p>
                </div>
                <Link
                  href="/esqueci-a-senha"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  Solicitar novo link
                </Link>
              </div>
            ) : done ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
                  <CheckCircle className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p>
                    Senha redefinida com sucesso! Agora você pode entrar com
                    sua nova senha.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <ArrowLeft className="size-4" />
                  Ir para o login
                </Link>
              </div>
            ) : (
              <form action={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nova senha</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Mínimo 8 caracteres"
                      className="pl-9"
                      minLength={8}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar nova senha</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirm"
                      name="confirm"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repita a senha"
                      className="pl-9"
                      minLength={8}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <CheckCircle className="size-4" />
                  )}
                  Redefinir senha
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <ArrowLeft className="size-3" />
                    Voltar ao login
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="cef-rise text-center text-xs text-muted-foreground">
          Acesso restrito · CRM CEF 2026
        </p>
      </div>
    </div>
  );
}

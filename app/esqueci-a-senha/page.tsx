"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { requestPasswordReset } from "./actions";
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

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (result.ok) {
        setSent(true);
      } else {
        setError(result.error ?? "Erro ao enviar e-mail.");
      }
    });
  }

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
              Recuperar senha
            </CardTitle>
            <CardDescription>
              Digite seu e-mail e enviaremos um link para redefinir sua senha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
                  <p className="font-medium">E-mail enviado!</p>
                  <p className="mt-1 text-muted-foreground">
                    Se esse endereço estiver cadastrado, você receberá um link
                    para redefinir sua senha em breve. Verifique também a caixa
                    de spam.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                >
                  <ArrowLeft className="size-4" />
                  Voltar ao login
                </Link>
              </div>
            ) : (
              <form action={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="voce@cef.org.br"
                      className="pl-9"
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
                    <Send className="size-4" />
                  )}
                  Enviar link de recuperação
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

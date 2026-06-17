"use client";

import { useActionState } from "react";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { authenticate, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

const initialState: LoginState = { stage: "password" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    authenticate,
    initialState,
  );

  const totp = state.stage === "totp";

  return (
    <form action={formAction} className="space-y-4">
      {totp ? (
        <>
          <input type="hidden" name="email" value={state.email ?? ""} />
          <input type="hidden" name="password" value={state.password ?? ""} />
          <div className="space-y-2">
            <Label htmlFor="token">Código de verificação</Label>
            <Input
              id="token"
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              autoFocus
              required
            />
            <p className="text-xs text-muted-foreground">
              Use o código do seu app autenticador ou um código de recuperação.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@cef.org.br"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link
                href="/esqueci-a-senha"
                className="text-xs text-muted-foreground hover:text-primary hover:underline"
                tabIndex={-1}
              >
                Esqueceu a senha?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>
        </>
      )}

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : totp ? (
          <ShieldCheck className="size-4" />
        ) : (
          <LogIn className="size-4" />
        )}
        {totp ? "Verificar" : "Entrar"}
      </Button>

      {!totp && (
        <>
          <div className="relative flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <GoogleSignInButton />
        </>
      )}
    </form>
  );
}

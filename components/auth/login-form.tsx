"use client";

import { useActionState } from "react";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { authenticate, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
            <Label htmlFor="password">Senha</Label>
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
    </form>
  );
}

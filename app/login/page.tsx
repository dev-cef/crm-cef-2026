import Image from "next/image";
import { LoginForm } from "@/components/auth/login-form";
import { CefLogo } from "@/components/layout/cef-logo";
import { CardBeam } from "@/components/ui/card-beam";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Entrar — CRM CEF",
};

export default function LoginPage() {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[1.15fr_1fr]">
      {/* Painel hero — montanha + transição de marca */}
      <aside className="relative hidden overflow-hidden lg:block">
        <Image
          src="/mountain-hero.jpg"
          alt="Pico nevado emergindo das nuvens"
          fill
          priority
          sizes="60vw"
          className="object-cover"
        />
        <div aria-hidden className="cef-hero-overlay absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="cef-rise flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white/95 p-1.5 shadow-lg">
              <CefLogo className="size-full" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-lg font-semibold">
                Centro Excursionista
              </p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">
                Friburguense
              </p>
            </div>
          </div>

          <div
            className="cef-rise max-w-md"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            <p className="font-display text-5xl font-semibold leading-[1.05] tracking-tight">
              Conquistar
            </p>
            <p className="mt-4 text-base text-white/80">
              Plataforma de gestão de associados, financeiro e expedições do
              clube. Cada cume começa com um primeiro passo.
            </p>
          </div>

          <p
            className="cef-rise text-xs text-white/60"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            CRM CEF · {new Date().getFullYear()}
          </p>
        </div>
      </aside>

      {/* Painel de acesso */}
      <main className="relative flex items-center justify-center overflow-hidden p-6">
        <div
          aria-hidden
          className="cef-aurora pointer-events-none absolute inset-0 -z-10 lg:hidden"
        />
        <div className="w-full max-w-sm space-y-7">
          <div className="flex flex-col items-center gap-3 text-center lg:hidden">
            <CefLogo className="size-20" />
            <h1 className="font-display text-xl font-semibold tracking-tight">
              Centro Excursionista Friburguense
            </h1>
          </div>

          <Card className="group cef-rise relative overflow-hidden border-border/70 shadow-xl shadow-primary/5">
            <CardBeam />
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                Bem-vindo de volta
              </CardTitle>
              <CardDescription>
                Acesse o painel com seu e-mail e senha.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>

          <p
            className="cef-rise text-center text-xs text-muted-foreground"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            Acesso restrito · CRM CEF 2026
          </p>
        </div>
      </main>
    </div>
  );
}

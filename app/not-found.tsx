import Link from "next/link";
import { Home, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { CefLogo } from "@/components/layout/cef-logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <CefLogo className="size-16 opacity-90" />
      <div className="space-y-2">
        <p className="font-display text-6xl font-semibold tracking-tight text-muted-foreground/70">
          404
        </p>
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Página não encontrada
        </h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          O endereço que você tentou acessar não existe ou foi movido. Verifique
          o link ou volte ao início.
        </p>
      </div>
      <Link href="/" className={cn(buttonVariants())}>
        <Home className="size-4" /> Voltar ao início
      </Link>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
        <Compass className="size-3.5" /> Clube Excursionista de Friburgo
      </p>
    </main>
  );
}

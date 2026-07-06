"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { CefLogo } from "@/components/layout/cef-logo";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <CefLogo className="size-16 opacity-90" />
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Algo deu errado
        </h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          Encontramos um problema ao carregar esta página. Tente novamente — se
          o erro persistir, avise a diretoria.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground/60">
            Ref: {error.digest}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>
          <RotateCw className="size-4" /> Tentar novamente
        </Button>
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
          <Home className="size-4" /> Início
        </Link>
      </div>
    </main>
  );
}

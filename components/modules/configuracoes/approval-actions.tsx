"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { aprovarConta, recusarConta } from "@/app/(app)/configuracoes/actions";
import { Button } from "@/components/ui/button";

export function ApprovalActions({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function run(fn: typeof aprovarConta, okMsg: string) {
    start(async () => {
      const r = await fn(userId);
      if (r.ok) {
        toast.success(okMsg);
        router.refresh();
      } else {
        toast.error(r.error ?? "Falha.");
      }
    });
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        onClick={() => run(aprovarConta, "Conta aprovada.")}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Aprovar
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => run(recusarConta, "Cadastro recusado.")}
        disabled={pending}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="size-4" />
        Recusar
      </Button>
    </div>
  );
}

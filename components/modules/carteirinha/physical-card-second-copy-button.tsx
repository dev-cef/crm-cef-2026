"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { createSecondCopyRequest } from "@/app/(app)/carteirinha/fisica/actions";
import { Button } from "@/components/ui/button";

export function PhysicalCardSecondCopyButton({ memberId }: { memberId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const res = await createSecondCopyRequest(memberId);

      if ("ok" in res && res.ok) {
        toast.success("Solicitação de 2ª via criada! Taxa de R$ 30,00 pendente.");
        if ("requestId" in res && res.requestId) {
          router.push(`/carteirinha/fisica/${res.requestId}`);
        } else {
          router.refresh();
        }
        return;
      }

      toast.error("error" in res ? res.error : "Erro ao criar solicitação de 2ª via.");
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
      Solicitar 2ª via
    </Button>
  );
}

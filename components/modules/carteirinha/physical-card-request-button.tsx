"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { createRequest } from "@/app/(app)/carteirinha/fisica/actions";
import { Button } from "@/components/ui/button";

type EligibilityResult = {
  isEligible: boolean;
  criterion1: { met: boolean; monthsAsOf: number };
  criterion2: { met: boolean; meetings: number; activities: number };
};

export function PhysicalCardRequestButton({
  memberId,
}: {
  memberId: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const res = await createRequest(memberId);

      if ("ok" in res && res.ok) {
        toast.success("Solicitação criada com sucesso!");
        if ("requestId" in res && res.requestId) {
          router.push(`/carteirinha/fisica/${res.requestId}`);
        } else {
          router.refresh();
        }
        return;
      }

      const eligibility = "eligibility" in res ? (res.eligibility as EligibilityResult) : null;
      const errorMsg = "error" in res ? res.error : "Erro ao criar solicitação.";

      if (eligibility) {
        toast.error(
          <div className="space-y-1 text-sm">
            <p className="font-medium">{errorMsg}</p>
            <div className="flex items-center gap-1.5">
              {eligibility.criterion1.met
                ? <CheckCircle className="size-3.5 text-primary shrink-0" />
                : <XCircle className="size-3.5 text-destructive shrink-0" />}
              <span>
                Sócio há {eligibility.criterion1.monthsAsOf} meses
                {!eligibility.criterion1.met && " (mínimo 3)"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {eligibility.criterion2.met
                ? <CheckCircle className="size-3.5 text-primary shrink-0" />
                : <XCircle className="size-3.5 text-destructive shrink-0" />}
              <span>
                {eligibility.criterion2.meetings} reunião(ões) + {eligibility.criterion2.activities} atividade(s)
                {!eligibility.criterion2.met && " (mínimo 2 + 2)"}
              </span>
            </div>
          </div>,
          { duration: 6000 },
        );
      } else {
        toast.error(errorMsg ?? "Erro ao criar solicitação.");
      }
    });
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      Nova solicitação
    </Button>
  );
}

"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { createRequest } from "@/app/(app)/carteirinha/fisica/actions";
import { membershipNumber } from "@/lib/membership";
import { STAGE_LABELS, type PhysicalCardStage } from "@/lib/physical-card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type CardRequest = {
  currentStage: string;
  quarter: number;
  year: number;
};

type Member = {
  id: string;
  fullName: string;
  registration: number;
  photoUrl: string | null;
  status: string;
  plan: { name: string } | null;
  cardRequest: CardRequest | null;
};

const STAGE_BADGE: Record<PhysicalCardStage, string> = {
  payment_pending: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  minimum_requirements: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  issuance_pending: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  in_production: "border-blue-600/60 bg-blue-600/20 text-blue-800 dark:text-blue-300",
  awaiting_pickup: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400",
  delivered: "border-border bg-muted text-muted-foreground",
  rejected: "border-destructive/40 bg-destructive/10 text-destructive",
};

type EligibilityResult = {
  isEligible: boolean;
  criterion1: { met: boolean; monthsAsOf: number };
  criterion2: { met: boolean; meetings: number; activities: number };
};

export function NewRequestDialog({ trigger }: { trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [pending, startTransition] = useTransition();
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);
  const router = useRouter();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/members/search?q=${encodeURIComponent(query)}&mode=physical`);
        const data = (await res.json()) as Member[];
        setResults(data);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query]);

  function handleSelect(m: Member) {
    setSelected(m);
    setResults([]);
    setQuery("");
    setEligibility(null);
  }

  function handleClear() {
    setSelected(null);
    setEligibility(null);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setEligibility(null);
    }
  }

  function handleSubmit() {
    if (!selected) return;
    startTransition(async () => {
      const res = await createRequest(selected.id);
      if (res.ok) {
        toast.success("Solicitação criada com sucesso!");
        setOpen(false);
        if (res.requestId) {
          router.push(`/carteirinha/fisica/${res.requestId}`);
        } else {
          router.refresh();
        }
      } else if ("eligibility" in res && res.eligibility) {
        setEligibility(res.eligibility as EligibilityResult);
        toast.error(res.error ?? "Associado não elegível.");
      } else {
        toast.error(res.error ?? "Erro ao criar solicitação.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova solicitação de carteirinha física</DialogTitle>
          <DialogDescription>
            Busque o associado pelo nome ou número de matrícula.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Busca */}
          {!selected && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome ou nº de matrícula..."
                className="pl-9"
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          )}

          {/* Resultados */}
          {results.length > 0 && !selected && (
            <ul className="max-h-52 overflow-y-auto rounded-md border">
              {results.map((m) => {
                const initials = m.fullName
                  .split(" ")
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(m)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                    >
                      <Avatar className="size-8 shrink-0">
                        {m.photoUrl && <img src={m.photoUrl} alt={m.fullName} />}
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          {membershipNumber(m.registration)} · {m.plan?.name ?? "Sem plano"}
                          {m.status === "INACTIVE" && (
                            <span className="ml-1 text-destructive">(Inativo)</span>
                          )}
                        </p>
                      </div>
                      {m.cardRequest && (
                        <span
                          className={cn(
                            "shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                            STAGE_BADGE[m.cardRequest.currentStage as PhysicalCardStage],
                          )}
                        >
                          {STAGE_LABELS[m.cardRequest.currentStage as PhysicalCardStage]}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Sócio selecionado */}
          {selected && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
                <Avatar className="size-10 shrink-0">
                  {selected.photoUrl && (
                    <img src={selected.photoUrl} alt={selected.fullName} />
                  )}
                  <AvatarFallback className="text-sm">
                    {selected.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{selected.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {membershipNumber(selected.registration)} · {selected.plan?.name ?? "Sem plano"}
                  </p>
                  {selected.cardRequest && (
                    <span
                      className={cn(
                        "mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                        STAGE_BADGE[selected.cardRequest.currentStage as PhysicalCardStage],
                      )}
                    >
                      {selected.cardRequest.quarter}º tri/{selected.cardRequest.year} · {STAGE_LABELS[selected.cardRequest.currentStage as PhysicalCardStage]}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Trocar
                </button>
              </div>

              {/* Resultado de elegibilidade após tentativa */}
              {eligibility && (
                <div className="rounded-md border bg-destructive/5 px-3 py-3 text-sm space-y-2">
                  <p className="font-medium text-destructive">Não atende aos critérios:</p>
                  <div className="flex items-center gap-2">
                    {eligibility.criterion1.met
                      ? <CheckCircle className="size-4 text-primary shrink-0" />
                      : <XCircle className="size-4 text-destructive shrink-0" />}
                    <span className="text-muted-foreground">
                      Sócio há {eligibility.criterion1.monthsAsOf} meses
                      {!eligibility.criterion1.met && " (mínimo 3)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {eligibility.criterion2.met
                      ? <CheckCircle className="size-4 text-primary shrink-0" />
                      : <XCircle className="size-4 text-destructive shrink-0" />}
                    <span className="text-muted-foreground">
                      {eligibility.criterion2.meetings} reunião(ões) + {eligibility.criterion2.activities} atividade(s)
                      {!eligibility.criterion2.met && " (mínimo 2 + 2)"}
                    </span>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={pending}
              >
                {pending
                  ? <Loader2 className="size-4 animate-spin" />
                  : <Plus className="size-4" />}
                Criar solicitação
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users, CheckCircle, XCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { createRequestBatch } from "@/app/(app)/carteirinha/fisica/actions";
import { membershipNumber } from "@/lib/membership";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type EligibilityResult = {
  isEligible: boolean;
  criterion1: { met: boolean; monthsAsOf: number };
  criterion2: { met: boolean; meetings: number; activities: number };
};

type EligibleMember = {
  id: string;
  fullName: string;
  registration: number;
  photoUrl: string | null;
  plan: { name: string } | null;
  eligibility: EligibilityResult;
};

export function BatchRequestDialog({ trigger }: { trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<EligibleMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/carteirinha/eligible-members");
      const data = (await res.json()) as EligibleMember[];
      setMembers(data);
      // Pré-selecionar todos os elegíveis
      setSelected(new Set(data.filter((m) => m.eligibility.isEligible).map((m) => m.id)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchMembers();
    else {
      setMembers([]);
      setSelected(new Set());
      setQuery("");
    }
  }, [open, fetchMembers]);

  const filtered = members.filter((m) =>
    m.fullName.toLowerCase().includes(query.toLowerCase()) ||
    String(m.registration).includes(query)
  );

  const eligibleCount = members.filter((m) => m.eligibility.isEligible).length;

  function toggleAll(onlyEligible: boolean) {
    const ids = members
      .filter((m) => (onlyEligible ? m.eligibility.isEligible : true))
      .map((m) => m.id);
    setSelected(new Set(ids));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const res = await createRequestBatch(Array.from(selected));
      if (res.ok) {
        const msg = `${res.created} solicitação(ões) criada(s)${res.skipped > 0 ? `, ${res.skipped} ignorada(s)` : ""}.`;
        toast.success(msg);
        if (res.errors.length > 0) {
          res.errors.forEach((e) => toast.warning(`${e.name}: ${e.reason}`, { duration: 6000 }));
        }
        setOpen(false);
        router.refresh();
      } else {
        toast.error("Erro ao criar solicitações em lote.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitação em lote</DialogTitle>
          <DialogDescription>
            Associados ativos sem solicitação no trimestre atual.
            {!loading && members.length > 0 && (
              <span className="ml-1 font-medium text-foreground">
                {eligibleCount} elegível(is) de {members.length}.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Barra de busca + atalhos */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar por nome ou matrícula…"
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => toggleAll(true)}
              className="text-primary underline-offset-2 hover:underline"
            >
              Selecionar elegíveis
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => toggleAll(false)}
              className="text-primary underline-offset-2 hover:underline"
            >
              Todos
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-muted-foreground underline-offset-2 hover:underline"
            >
              Limpar
            </button>
            <span className="ml-auto text-muted-foreground">{selected.size} selecionado(s)</span>
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto rounded-md border divide-y">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {query ? "Nenhum resultado." : "Todos os associados já têm solicitação este trimestre."}
              </p>
            ) : (
              filtered.map((m) => {
                const initials = m.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
                const isSelected = selected.has(m.id);
                return (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(m.id)}
                      className="shrink-0"
                    />
                    <Avatar className="size-8 shrink-0">
                      {m.photoUrl && <AvatarImage src={m.photoUrl} alt={m.fullName} />}
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {membershipNumber(m.registration)} · {m.plan?.name ?? "Sem plano"}
                      </p>
                    </div>
                    {m.eligibility.isEligible ? (
                      <CheckCircle className="size-4 shrink-0 text-primary" />
                    ) : (
                      <span title={`${m.eligibility.criterion1.monthsAsOf} meses · ${m.eligibility.criterion2.meetings}R+${m.eligibility.criterion2.activities}A`}>
                        <XCircle className="size-4 shrink-0 text-muted-foreground" />
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} type="button">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={pending || selected.size === 0}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Users className="size-4" />
            )}
            Criar {selected.size > 0 ? `${selected.size} ` : ""}solicitação(ões)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Users, UserPlus, UserMinus, Search, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { assignDependent, removeDependent } from "@/app/(app)/associados/actions";

type MinMember = {
  id: string;
  fullName: string;
  registration: number;
  photoUrl: string | null;
  phone: string;
  plan: { name: string } | null;
};

type Props = {
  memberId: string;
  planName: string;
  role: "titular" | "dependente";
  linked: MinMember | null;
};

export function FamilyPlanCard({ memberId, role, linked }: Props) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MinMember[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!searchOpen) {
      setQuery("");
      setResults([]);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    fetch(`/api/members/search?q=${encodeURIComponent(query.trim())}&exclude=${memberId}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((data: MinMember[]) => setResults(data))
      .catch(() => {})
      .finally(() => setSearching(false));
    return () => ctrl.abort();
  }, [query, memberId]);

  function handleAssign(candidateId: string) {
    startTransition(async () => {
      const res = await assignDependent(memberId, candidateId);
      if (res.ok) {
        toast.success("Dependente vinculado com sucesso.");
        setSearchOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleRemove() {
    if (!linked) return;
    const dependenteId = role === "titular" ? linked.id : memberId;
    const titularId = role === "titular" ? memberId : linked.id;
    startTransition(async () => {
      const res = await removeDependent(titularId, dependenteId);
      if (res.ok) {
        toast.success("Dependente removido.");
        setRemoveOpen(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  const isTitular = role === "titular";
  const linkedLabel = isTitular ? "Dependente (cônjuge)" : "Titular";

  return (
    <Card className="md:col-span-3 border-amber-500/40 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
          <Users className="size-4" />
          Plano Família
          <Badge variant="secondary" className="ml-auto font-normal">
            {isTitular ? "Titular" : "Dependente"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {linked ? (
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback>
                {linked.fullName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{linked.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {linkedLabel} · Mat. #{linked.registration} · {linked.phone}
              </p>
            </div>
            <Link
              href={`/associados/${linked.id}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Ver perfil
            </Link>
            {isTitular && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => setRemoveOpen(true)}
                disabled={pending}
              >
                <UserMinus className="size-4" />
              </Button>
            )}
          </div>
        ) : isTitular ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Nenhum dependente vinculado. Adicione o cônjuge para completar o plano.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSearchOpen(true)}
              disabled={pending}
            >
              <UserPlus className="size-4 mr-1" /> Adicionar dependente
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Titular não encontrado.</p>
        )}
      </CardContent>

      {/* Busca de dependente */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar dependente</DialogTitle>
            <DialogDescription>
              Busque o cônjuge pelo nome ou matrícula. Apenas associados sem vínculo aparecem.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou matrícula…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="min-h-[120px] max-h-60 overflow-y-auto">
            {searching && (
              <p className="py-4 text-center text-sm text-muted-foreground">Buscando…</p>
            )}
            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum resultado.</p>
            )}
            {!searching && query.trim().length < 2 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Digite pelo menos 2 caracteres.
              </p>
            )}
            {results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleAssign(m.id)}
                disabled={pending}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-muted transition-colors"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">
                    {m.fullName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    Mat. #{m.registration}
                    {m.plan ? ` · ${m.plan.name}` : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSearchOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de remoção */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              Remover dependente?
            </DialogTitle>
            <DialogDescription>
              <strong>{linked?.fullName}</strong> será desvinculado deste plano Família. O associado
              permanece no sistema mas sem vínculo de dependente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRemoveOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={pending}
            >
              Remover vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

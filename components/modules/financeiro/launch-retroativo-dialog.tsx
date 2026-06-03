"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, History, Search, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { launchMemberMonthlyRange } from "@/app/(app)/financeiro/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const MONTHS = [
  { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" }, { value: 4, label: "Abril" },
  { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
  { value: 7, label: "Julho" }, { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" }, { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
];

const now = new Date();
const CURRENT_MONTH = now.getMonth() + 1;
const CURRENT_YEAR = now.getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 5 + i);

type Member = { id: string; fullName: string; registration: number; plan: { name: string } | null };

function monthCount(fm: number, fy: number, tm: number, ty: number) {
  return (ty - fy) * 12 + (tm - fm) + 1;
}

export function LaunchRetroativoDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Member search
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Date range
  const [fromMonth, setFromMonth] = useState(1);
  const [fromYear, setFromYear] = useState(CURRENT_YEAR - 1);
  const [toMonth, setToMonth] = useState(CURRENT_MONTH);
  const [toYear, setToYear] = useState(CURRENT_YEAR);

  useEffect(() => {
    if (!open) {
      setQuery(""); setResults([]); setSelected(null);
      setFromMonth(1); setFromYear(CURRENT_YEAR - 1);
      setToMonth(CURRENT_MONTH); setToYear(CURRENT_YEAR);
    }
  }, [open]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/members/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data);
      setSearching(false);
    }, 300);
  }, [query]);

  const total = monthCount(fromMonth, fromYear, toMonth, toYear);
  const isRangeValid = fromYear < toYear || (fromYear === toYear && fromMonth <= toMonth);
  const canSubmit = !!selected && isRangeValid && total >= 1 && total <= 120;

  function handleConfirm() {
    if (!selected) return;
    startTransition(async () => {
      const res = await launchMemberMonthlyRange(
        selected.id, fromMonth, fromYear, toMonth, toYear,
      );
      if (res.ok) {
        const msg = res.created > 0
          ? `${res.created} mensalidade(s) lançada(s)${res.skipped > 0 ? `, ${res.skipped} já existiam` : ""}.`
          : `Nenhum novo lançamento — todos os ${res.skipped} meses já existiam.`;
        toast.success(msg);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao lançar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" variant="outline">
          <History className="size-4" /> Lançar retroativo
        </Button>
      } />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" /> Lançar mensalidades retroativas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Member search */}
          <div className="space-y-1.5">
            <Label>Associado <span className="text-destructive">*</span></Label>
            {selected ? (
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{selected.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    #{selected.registration} · {selected.plan?.name ?? "Sem plano"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => { setSelected(null); setQuery(""); }}
                >
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por nome ou matrícula…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
                {(results.length > 0 || searching) && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover shadow-md">
                    {searching && (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" /> Buscando…
                      </div>
                    )}
                    {results.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => { setSelected(m); setQuery(""); setResults([]); }}
                      >
                        <span className="font-medium">{m.fullName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          #{m.registration} · {m.plan?.name ?? "Sem plano"}
                        </span>
                      </button>
                    ))}
                    {!searching && results.length === 0 && query.length >= 2 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date range */}
          <div className="space-y-3">
            <Label>Período de competência</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">De</p>
                <div className="flex gap-1.5">
                  <Select value={String(fromMonth)} onValueChange={(v) => setFromMonth(Number(v))}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={String(fromYear)} onValueChange={(v) => setFromYear(Number(v))}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Até</p>
                <div className="flex gap-1.5">
                  <Select value={String(toMonth)} onValueChange={(v) => setToMonth(Number(v))}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={String(toYear)} onValueChange={(v) => setToYear(Number(v))}>
                    <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* Summary */}
          {selected && isRangeValid && (
            <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
              <p>
                Serão gerados <strong>{total} lançamento(s)</strong> de{" "}
                <strong>{MONTHS[fromMonth - 1].label}/{fromYear}</strong> até{" "}
                <strong>{MONTHS[toMonth - 1].label}/{toYear}</strong> para{" "}
                <strong>{selected.fullName}</strong>.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Meses já existentes serão ignorados automaticamente.
              </p>
            </div>
          )}

          {!isRangeValid && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              O mês inicial deve ser anterior ou igual ao mês final.
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={pending} />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleConfirm} disabled={pending || !canSubmit}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <History className="size-4" />}
            Lançar {canSubmit ? `${total} mês${total > 1 ? "es" : ""}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown, Check, UserRound, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Member { id: string; fullName: string; registration?: string | null; }

interface Props {
  membros: Member[];
  value?: string;
  onChange: (id: string | undefined) => void;
  placeholder?: string;
}

export function MemberCombobox({ membros, value, onChange, placeholder = "Buscar sócio..." }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = membros.find((m) => m.id === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return membros;
    const q = search.toLowerCase();
    return membros.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.registration?.toLowerCase().includes(q),
    );
  }, [membros, search]);

  function select(m: Member) {
    onChange(m.id);
    setOpen(false);
    setSearch("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(undefined);
  }

  const initials = selected
    ? selected.fullName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg border bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              open && "ring-2 ring-ring",
            )}
          >
            {selected ? (
              <>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials}
                </span>
                <span className="flex-1 text-left">
                  <span className="font-medium">{selected.fullName}</span>
                  {selected.registration && (
                    <span className="ml-2 text-xs text-muted-foreground font-mono">#{selected.registration}</span>
                  )}
                </span>
                <span onClick={clear} className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="size-3.5" />
                </span>
              </>
            ) : (
              <>
                <UserRound className="size-4 text-muted-foreground shrink-0" />
                <span className="flex-1 text-left text-muted-foreground">{placeholder}</span>
                <ChevronDown className="size-4 text-muted-foreground shrink-0" />
              </>
            )}
          </button>
        }
      />

      <PopoverContent align="start" className="w-80 p-0">
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou matrícula..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Member list */}
        <ul className="max-h-60 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="py-6 text-center text-sm text-muted-foreground">
              Nenhum sócio encontrado.
            </li>
          ) : (
            filtered.map((m) => {
              const isSelected = m.id === value;
              const ini = m.fullName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => select(m)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted",
                      isSelected && "bg-muted",
                    )}
                  >
                    <span className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}>
                      {ini}
                    </span>
                    <span className="flex-1 text-left">
                      <span className="block font-medium leading-tight">{m.fullName}</span>
                      {m.registration && (
                        <span className="text-xs text-muted-foreground font-mono">Matrícula #{m.registration}</span>
                      )}
                    </span>
                    {isSelected && <Check className="size-4 text-primary shrink-0" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="border-t px-3 py-2 text-xs text-muted-foreground">
          {filtered.length} sócio{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
        </div>
      </PopoverContent>
    </Popover>
  );
}

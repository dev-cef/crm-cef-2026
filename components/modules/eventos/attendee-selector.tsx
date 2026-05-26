"use client";

import { useState } from "react";
import { UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type MemberOption = { id: string; fullName: string };

export function AttendeeSelector({
  members,
  value,
  onChange,
  disabled,
}: {
  members: MemberOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");

  const selectedMembers = members.filter((m) => value.includes(m.id));
  const showDropdown =
    search.length > 0 &&
    members.some(
      (m) =>
        !value.includes(m.id) &&
        m.fullName.toLowerCase().includes(search.toLowerCase()),
    );
  const filtered = members.filter(
    (m) =>
      !value.includes(m.id) &&
      m.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  function add(id: string) {
    if (value.includes(id)) return;
    onChange([...value, id]);
    setSearch("");
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar associado por nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none disabled:opacity-50"
        />
        {showDropdown && (
          <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-background shadow-md">
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => add(m.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
              >
                <UserCheck className="size-3.5 shrink-0 text-muted-foreground" />
                {m.fullName}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum associado selecionado.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {selectedMembers.map((m, idx) => (
            <li
              key={m.id}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                  {idx + 1}
                </span>
                <span>{m.fullName}</span>
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  onClick={() => remove(m.id)}
                  aria-label="Remover"
                >
                  <X className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        {selectedMembers.length} associado(s) marcado(s) como presente(s)
      </p>
    </div>
  );
}

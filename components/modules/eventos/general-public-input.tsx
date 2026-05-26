"use client";

import { useState } from "react";
import { Plus, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GeneralPublicInput({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
}) {
  const [name, setName] = useState("");

  function add() {
    const trimmed = name.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setName("");
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {!disabled && (
        <div className="flex gap-2">
          <Input
            placeholder="Nome do visitante / público em geral…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={add}
            disabled={!name.trim()}
          >
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
      )}

      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum visitante adicionado.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {value.map((n, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
                  {idx + 1}
                </span>
                <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
                <span>{n}</span>
              </div>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  type="button"
                  onClick={() => remove(idx)}
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
        {value.length} visitante(s) do público em geral
      </p>
    </div>
  );
}

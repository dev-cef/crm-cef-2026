"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createUser } from "@/app/(app)/configuracoes/seguranca/actions";

type Department = { id: string; name: string };

export function CreateUserDialog({
  departments,
}: {
  departments: Department[];
}) {
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState("ADMIN");
  const [pending, startTransition] = useTransition();

  function handleOpenChange(v: boolean) {
    if (!pending) setOpen(v);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get("name") as string,
      email: fd.get("email") as string,
      password: fd.get("password") as string,
      role: fd.get("role") as string,
      departmentId: (fd.get("departmentId") as string) || undefined,
    };

    startTransition(async () => {
      const res = await createUser(data);
      if (res.ok) {
        toast.success("Usuário criado com sucesso");
        setOpen(false);
      } else {
        toast.error(res.error ?? "Erro ao criar usuário");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm">
            <UserPlus className="size-4" /> Criar usuário
          </Button>
        }
      />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar usuário</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" name="name" required placeholder="João da Silva" />
          </div>

          {/* E-mail */}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder="joao@exemplo.com"
            />
          </div>

          {/* Senha */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPw ? "text" : "password"}
                required
                placeholder="Mín. 12 caracteres"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Mín. 12 caracteres com maiúscula, minúscula, número e símbolo.
            </p>
          </div>

          {/* Papel */}
          <div className="space-y-1.5">
            <Label htmlFor="role">Papel</Label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="ADMIN">Administrador</option>
              <option value="DEPARTAMENTO">Departamento</option>
              <option value="ASSOCIADO">Associado</option>
            </select>
          </div>

          {/* Departamento — só aparece para DEPARTAMENTO */}
          {role === "DEPARTAMENTO" && (
            <div className="space-y-1.5">
              <Label htmlFor="departmentId">Departamento</Label>
              <select
                id="departmentId"
                name="departmentId"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">— sem departamento —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Criando…" : "Criar usuário"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

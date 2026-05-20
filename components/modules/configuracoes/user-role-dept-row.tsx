"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  setUserRole,
  setUserDepartment,
  resetUserPassword,
  updateUserEmail,
  deleteUser,
} from "@/app/(app)/configuracoes/seguranca/actions";

type Department = { id: string; name: string };

type Props = {
  userId: string;
  name: string;
  email: string;
  role: string;
  currentDeptId: string | null;
  departments: Department[];
  isSelf: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  DEPARTAMENTO: "Departamento",
  ASSOCIADO: "Associado",
};

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  DEPARTAMENTO: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  ASSOCIADO: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
};

function UpdateEmailDialog({
  userId,
  name,
  currentEmail,
}: {
  userId: string;
  name: string;
  currentEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(currentEmail);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateUserEmail(userId, email);
      if (res.ok) {
        toast.success(`E-mail de ${name} atualizado`);
        setOpen(false);
      } else {
        toast.error(res.error ?? "Erro ao atualizar e-mail");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!pending) setOpen(v); }}
    >
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" title="Alterar e-mail">
            <Mail className="size-4" />
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Alterar e-mail — {name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="novo@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={pending || !email || email === currentEmail}
            >
              {pending ? "Salvando…" : "Salvar e-mail"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await resetUserPassword(userId, password);
      if (res.ok) {
        toast.success(`Senha de ${name} alterada com sucesso`);
        setOpen(false);
        setPassword("");
      } else {
        toast.error(res.error ?? "Erro ao alterar senha");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!pending) { setOpen(v); if (!v) setPassword(""); } }}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" title="Alterar senha">
            <KeyRound className="size-4" />
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Alterar senha — {name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                placeholder="Nova senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pr-10"
                autoFocus
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
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !password}>
              {pending ? "Salvando…" : "Salvar senha"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({
  userId,
  name,
  email,
}: {
  userId: string;
  name: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const res = await deleteUser(userId);
      if (res.ok) {
        toast.success(`Usuário ${name} excluído`);
        setOpen(false);
      } else {
        toast.error(res.error ?? "Erro ao excluir usuário");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!pending) setOpen(v); }}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" title="Excluir usuário" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Excluir usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1 text-sm text-muted-foreground">
          <p>
            Tem certeza que deseja excluir <strong className="text-foreground">{name}</strong>?
          </p>
          <p className="text-xs">{email}</p>
          <p className="text-xs text-destructive">
            Esta ação é irreversível. O usuário perderá acesso imediatamente.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? "Excluindo…" : "Excluir usuário"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UserRoleDeptRow({
  userId,
  name,
  email,
  role: initialRole,
  currentDeptId,
  departments,
  isSelf,
}: Props) {
  const [role, setRole] = useState(initialRole);
  const [deptId, setDeptId] = useState(currentDeptId ?? "");
  const [pending, startTransition] = useTransition();

  function handleRoleChange(newRole: string) {
    const prev = role;
    setRole(newRole);
    if (newRole !== "DEPARTAMENTO") setDeptId("");

    startTransition(async () => {
      const res = await setUserRole(userId, newRole);
      if (!res.ok) {
        setRole(prev);
        toast.error(res.error ?? "Erro ao alterar papel");
      } else {
        toast.success("Papel atualizado");
      }
    });
  }

  function handleDeptChange(newDeptId: string) {
    const prev = deptId;
    setDeptId(newDeptId);
    startTransition(async () => {
      const res = await setUserDepartment(userId, newDeptId || null);
      if (!res.ok) {
        setDeptId(prev);
        toast.error("Erro ao atribuir departamento");
      } else {
        toast.success(newDeptId ? "Departamento atribuído" : "Departamento removido");
      }
    });
  }

  return (
    <tr className="border-b transition-colors hover:bg-muted/40">
      {/* Usuário */}
      <td className="px-4 py-3">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{email}</p>
      </td>

      {/* Papel atual (badge) */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE[role] ?? ""}`}>
          {ROLE_LABELS[role] ?? role}
        </span>
      </td>

      {/* Selector de papel */}
      <td className="px-4 py-3">
        <select
          value={role}
          disabled={isSelf || pending}
          onChange={(e) => handleRoleChange(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="ADMIN">Administrador</option>
          <option value="DEPARTAMENTO">Departamento</option>
          <option value="ASSOCIADO">Associado</option>
        </select>
        {isSelf && (
          <span className="ml-2 text-xs text-muted-foreground">sua conta</span>
        )}
      </td>

      {/* Selector de departamento */}
      <td className="px-4 py-3">
        {role === "DEPARTAMENTO" ? (
          <select
            value={deptId}
            disabled={pending}
            onChange={(e) => handleDeptChange(e.target.value)}
            className="h-8 rounded-md border bg-background px-2 text-sm disabled:opacity-50"
          >
            <option value="">— sem departamento —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Ações */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <UpdateEmailDialog userId={userId} name={name} currentEmail={email} />
          <ResetPasswordDialog userId={userId} name={name} />
          {!isSelf && (
            <DeleteUserDialog userId={userId} name={name} email={email} />
          )}
        </div>
      </td>
    </tr>
  );
}

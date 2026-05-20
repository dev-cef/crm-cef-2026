"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { setUserRole, setUserDepartment } from "@/app/(app)/configuracoes/seguranca/actions";

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
    </tr>
  );
}

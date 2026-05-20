"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Building2, Pencil, Plus, Settings2, Trash2, Users } from "lucide-react";
import { excluirDepartamento } from "@/app/(app)/configuracoes/departamentos/actions";
import { CRM_MODULES } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DeptFormModal } from "./dept-form-modal";
import { DeptPermissionSheet } from "./dept-permission-sheet";

interface DeptPermRow {
  moduleSlug: string;
  canView: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canExport: boolean;
}

interface Dept {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  active: boolean;
  _count: { users: number };
  permissions: DeptPermRow[];
}

interface Props {
  departments: Dept[];
}

function PermSummary({ permissions }: { permissions: DeptPermRow[] }) {
  if (permissions.length === 0) {
    return <span className="text-xs text-muted-foreground">Permissões padrão (não configurado)</span>;
  }
  const configured = permissions.map((p) => p.moduleSlug);
  return (
    <div className="flex flex-wrap gap-1">
      {CRM_MODULES.filter((m) => configured.includes(m.slug)).map(({ slug, label }) => {
        const p = permissions.find((r) => r.moduleSlug === slug)!;
        const actions = [
          p.canView && "V",
          p.canCreate && "C",
          p.canEdit && "E",
          p.canDelete && "D",
          p.canExport && "X",
        ].filter(Boolean).join("");
        return (
          <span
            key={slug}
            className="rounded border border-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            title={label}
          >
            {label.slice(0, 5)} [{actions || "—"}]
          </span>
        );
      })}
    </div>
  );
}

export function DeptList({ departments }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [sheetDept, setSheetDept] = useState<Dept | null>(null);
  const [deletePending, startDelete] = useTransition();

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(d: Dept) { setEditing(d); setFormOpen(true); }

  function handleDelete(dept: Dept) {
    startDelete(async () => {
      const r = await excluirDepartamento(dept.id);
      if (r.ok) toast.success("Departamento excluído.");
      else toast.error(r.error ?? "Falha ao excluir.");
    });
  }

  return (
    <>
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {departments.length === 0
            ? "Nenhum departamento cadastrado."
            : `${departments.length} departamento${departments.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" /> Novo departamento
        </Button>
      </div>

      {/* ── Empty state ── */}
      {departments.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-14 text-center text-muted-foreground">
          <Building2 className="size-10 opacity-30" />
          <p className="text-sm">Crie o primeiro departamento para gerenciar permissões de acesso.</p>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="size-4" /> Criar departamento
          </Button>
        </div>
      )}

      {/* ── Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => (
          <div
            key={d.id}
            className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm"
          >
            {/* Header do card */}
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 size-4 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{d.name}</p>
                <p className="text-xs text-muted-foreground">/{d.slug}</p>
              </div>
            </div>

            {d.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{d.description}</p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              {d._count.users} usuário{d._count.users !== 1 ? "s" : ""}
            </div>

            {/* Resumo de permissões */}
            <div className="border-t pt-2">
              <PermSummary permissions={d.permissions} />
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-1 border-t pt-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => setSheetDept(d)}
              >
                <Settings2 className="size-3.5" /> Permissões
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Editar"
                onClick={() => openEdit(d)}
              >
                <Pencil className="size-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Excluir"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={deletePending}
                    />
                  }
                >
                  <Trash2 className="size-4" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir departamento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O departamento <strong>{d.name}</strong> e todas as suas permissões serão removidos permanentemente.
                      {d._count.users > 0 && (
                        <span className="mt-2 block text-destructive">
                          Atenção: {d._count.users} usuário(s) vinculado(s). Desvincule-os antes de excluir.
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDelete(d)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modals ── */}
      <DeptFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
      />

      {sheetDept && (
        <DeptPermissionSheet
          open={!!sheetDept}
          onClose={() => setSheetDept(null)}
          departmentId={sheetDept.id}
          departmentName={sheetDept.name}
          departmentColor={sheetDept.color}
          savedPermissions={sheetDept.permissions}
        />
      )}
    </>
  );
}

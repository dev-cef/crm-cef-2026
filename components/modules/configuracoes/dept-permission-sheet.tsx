"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { salvarPermissoesDept } from "@/app/(app)/configuracoes/departamentos/actions";
import {
  CRM_MODULES,
  PERMISSION_ACTIONS,
  type ModuleSlug,
  type PermissionAction,
} from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type PermRow = Record<PermissionAction, boolean>;
type PermState = Record<ModuleSlug, PermRow>;

interface DeptPermissionRow {
  moduleSlug: string;
  canView: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canExport: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  departmentId: string;
  departmentName: string;
  departmentColor: string;
  savedPermissions: DeptPermissionRow[];
}

const ACTION_FIELD: Record<PermissionAction, keyof DeptPermissionRow> = {
  view:   "canView",
  edit:   "canEdit",
  create: "canCreate",
  delete: "canDelete",
  export: "canExport",
};

function buildInitial(saved: DeptPermissionRow[]): PermState {
  const bySlug = Object.fromEntries(saved.map((r) => [r.moduleSlug, r]));
  return Object.fromEntries(
    CRM_MODULES.map(({ slug }) => {
      const row = bySlug[slug];
      return [slug, {
        view:   row?.canView   ?? true,
        edit:   row?.canEdit   ?? true,
        create: row?.canCreate ?? true,
        delete: row?.canDelete ?? false,
        export: row?.canExport ?? true,
      }];
    }),
  ) as PermState;
}

export function DeptPermissionSheet({ open, onClose, departmentId, departmentName, departmentColor, savedPermissions }: Props) {
  const [perms, setPerms] = useState<PermState>(() => buildInitial(savedPermissions));
  const [pending, start] = useTransition();

  // Quando o sheet é reaberto com dados novos, reinicia o estado.
  const [lastDeptId, setLastDeptId] = useState(departmentId);
  if (lastDeptId !== departmentId) {
    setLastDeptId(departmentId);
    setPerms(buildInitial(savedPermissions));
  }

  function toggle(module: ModuleSlug, action: PermissionAction) {
    setPerms((prev) => {
      const next = { ...prev, [module]: { ...prev[module], [action]: !prev[module][action] } };
      // Regra: se desligar view, desliga tudo no módulo.
      if (action === "view" && !next[module].view) {
        next[module] = { view: false, create: false, edit: false, delete: false, export: false };
      }
      // Regra: create/edit/export requerem view; delete requer view+edit.
      if (action === "create" && next[module].create) next[module].view = true;
      if (action === "edit"   && next[module].edit)   next[module].view = true;
      if (action === "export" && next[module].export) next[module].view = true;
      if (action === "delete" && next[module].delete) {
        next[module].view = true;
        next[module].edit = true;
      }
      return next;
    });
  }

  function save() {
    start(async () => {
      const payload = Object.fromEntries(
        Object.entries(perms).map(([slug, p]) => [
          slug,
          {
            canView:   p.view,
            canEdit:   p.edit,
            canCreate: p.create,
            canDelete: p.delete,
            canExport: p.export,
          },
        ]),
      );
      const r = await salvarPermissoesDept(departmentId, payload);
      if (r.ok) { toast.success("Permissões salvas."); onClose(); }
      else toast.error(r.error ?? "Falha ao salvar.");
    });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-2xl">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <span
              className="size-4 rounded-full shrink-0"
              style={{ backgroundColor: departmentColor }}
            />
            <SheetTitle className="text-base">{departmentName}</SheetTitle>
          </div>
          <SheetDescription>
            Configure quais módulos do CRM este departamento pode acessar e quais ações são permitidas.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="overflow-x-auto">
            {/* Header da tabela */}
            <div className="mb-2 grid min-w-[420px] grid-cols-[140px_repeat(5,_1fr)] gap-x-2 px-1 text-xs font-medium text-muted-foreground">
              <span>Módulo</span>
              {PERMISSION_ACTIONS.map(({ key, label }) => (
                <span key={key} className="text-center">{label}</span>
              ))}
            </div>

            <div className="space-y-1">
              {CRM_MODULES.map(({ slug, label }) => (
                <div
                  key={slug}
                  className={cn(
                    "grid min-w-[420px] grid-cols-[140px_repeat(5,_1fr)] items-center gap-x-2 rounded-lg px-1 py-2.5 transition-colors",
                    perms[slug as ModuleSlug].view ? "hover:bg-muted/40" : "opacity-50",
                  )}
                >
                  <Label className="cursor-pointer text-sm font-medium">{label}</Label>
                  {PERMISSION_ACTIONS.map(({ key, requires }) => {
                    const isOn = perms[slug as ModuleSlug][key];
                    const depsMet = !requires || requires.every(
                      (dep) => perms[slug as ModuleSlug][dep],
                    );
                    return (
                      <div key={key} className="flex justify-center">
                        <Switch
                          checked={isOn}
                          onCheckedChange={() => toggle(slug as ModuleSlug, key)}
                          disabled={!depsMet && !isOn}
                          aria-label={`${label} — ${key}`}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            <strong>Regras:</strong> desligar "Visualizar" remove todas as ações do módulo.
            "Excluir" requer "Visualizar" e "Editar" ativos.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Salvar permissões
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

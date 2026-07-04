import { Lock, Users, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DOC_NIVEL_LABELS,
  DOC_STATUS_LABELS,
  type DocNivelAcesso,
  type DocStatus,
} from "@/lib/documentos/types";

const STATUS_CLASSES: Record<DocStatus, string> = {
  ATIVO: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border-transparent",
  ARQUIVADO: "bg-muted text-muted-foreground border-transparent",
  EM_REVISAO: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-transparent",
};

export function DocStatusBadge({ status }: { status: string }) {
  const s = status as DocStatus;
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[s])}>
      {DOC_STATUS_LABELS[s] ?? status}
    </Badge>
  );
}

const NIVEL_ICON: Record<DocNivelAcesso, typeof Users> = {
  ASSOCIADOS: Users,
  DIRETORIA: Lock,
  ADMIN: ShieldAlert,
};

const NIVEL_CLASSES: Record<DocNivelAcesso, string> = {
  ASSOCIADOS: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-transparent",
  DIRETORIA: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border-transparent",
  ADMIN: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-transparent",
};

export function DocNivelBadge({ nivel }: { nivel: string }) {
  const n = nivel as DocNivelAcesso;
  const Icon = NIVEL_ICON[n] ?? Lock;
  return (
    <Badge variant="outline" className={cn("gap-1", NIVEL_CLASSES[n])}>
      <Icon className="size-3" />
      {DOC_NIVEL_LABELS[n] ?? nivel}
    </Badge>
  );
}

export function DocVencidoBadge({ validadeEm }: { validadeEm: Date | null }) {
  if (!validadeEm || new Date(validadeEm) >= new Date()) return null;
  return (
    <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-transparent">
      Vencido
    </Badge>
  );
}

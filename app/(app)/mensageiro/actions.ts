"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { getMessengerConfig } from "@/lib/messenger";

type Result = { ok: boolean; error?: string };

async function saveTemplate(
  field: "template" | "receiptTemplate" | "paymentTemplate",
  enabledField: "enabled" | "receiptEnabled" | "paymentEnabled",
  template: string,
  enabled: boolean,
): Promise<Result> {
  const session = await auth();
  // A UI já esconde os cards sem permissão, mas a Server Action é um endpoint
  // POST próprio — re-checa aqui para não confiar só no gate de rota/UI.
  const sessionUser = toSessionUser(session?.user ?? {});
  if (!(await can(sessionUser, "mensageiro", "edit"))) {
    return { ok: false, error: "Você não tem permissão para editar o Mensageiro." };
  }
  if (template.trim().length < 5) {
    return { ok: false, error: "O texto da mensagem é muito curto." };
  }
  const cfg = await getMessengerConfig();
  await prisma.messengerConfig.update({
    where: { id: cfg.id },
    data: { [field]: template.trim(), [enabledField]: enabled },
  });
  await recordAudit({
    userId: session?.user?.id,
    action: "UPDATE",
    entity: "MessengerConfig",
    entityId: cfg.id,
    metadata: { field },
  });
  revalidatePath("/mensageiro");
  return { ok: true };
}

export async function saveBirthdayTemplate(template: string, enabled: boolean): Promise<Result> {
  return saveTemplate("template", "enabled", template, enabled);
}

export async function saveReceiptTemplate(template: string, enabled: boolean): Promise<Result> {
  return saveTemplate("receiptTemplate", "receiptEnabled", template, enabled);
}

export async function savePaymentTemplate(template: string, enabled: boolean): Promise<Result> {
  return saveTemplate("paymentTemplate", "paymentEnabled", template, enabled);
}

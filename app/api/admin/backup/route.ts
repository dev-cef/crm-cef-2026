import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  await requireAdmin();

  const [
    members,
    plans,
    payments,
    transactions,
    events,
    registrations,
    photos,
    departments,
    deptPermissions,
    userDepartments,
    users,
    birthdayConfig,
    systemConfig,
    auditLogs,
  ] = await Promise.all([
    prisma.member.findMany({ orderBy: { registration: "asc" } }),
    prisma.plan.findMany({ orderBy: { name: "asc" } }),
    prisma.payment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.transaction.findMany({ orderBy: { date: "asc" } }),
    prisma.event.findMany({ orderBy: { dateTime: "asc" } }),
    prisma.eventRegistration.findMany(),
    prisma.eventPhoto.findMany(),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.deptModulePermission.findMany(),
    prisma.userDepartment.findMany(),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        approved: true,
        totpEnabled: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        // passwordHash, totpSecret, totpRecoveryCodes excluídos intencionalmente
      },
    }),
    prisma.birthdayMessageConfig.findMany(),
    prisma.systemConfig.findMany(),
    prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const counts = {
    members: members.length,
    plans: plans.length,
    payments: payments.length,
    transactions: transactions.length,
    events: events.length,
    eventRegistrations: registrations.length,
    departments: departments.length,
    users: users.length,
    auditLogs: auditLogs.length,
  };

  const backup = {
    meta: {
      generatedAt: new Date().toISOString(),
      version: "1.0",
      system: "CRM CEF 2026",
      counts,
    },
    data: {
      users,
      departments,
      deptModulePermissions: deptPermissions,
      userDepartments,
      members,
      plans,
      payments,
      transactions,
      events,
      eventRegistrations: registrations,
      eventPhotos: photos,
      birthdayMessageConfig: birthdayConfig,
      systemConfig,
      auditLogs,
    },
  };

  await recordAudit({
    userId: session?.user?.id,
    action: "EXPORT",
    entity: "Backup",
    entityId: "full",
    metadata: counts,
  });

  const date = new Date().toISOString().split("T")[0];
  const filename = `backup-crm-cef-${date}.json`;

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

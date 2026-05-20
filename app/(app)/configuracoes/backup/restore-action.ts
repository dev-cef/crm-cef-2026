"use server";

import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

type RestoredCounts = {
  users: number;
  departments: number;
  plans: number;
  members: number;
  payments: number;
  transactions: number;
  events: number;
  eventRegistrations: number;
};

export async function restoreBackup(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  backupData: Record<string, any>,
): Promise<{ ok: boolean; counts?: RestoredCounts; error?: string }> {
  const session = await auth();
  await requireAdmin();

  const { data } = backupData;
  if (!data) return { ok: false, error: "Arquivo de backup inválido." };

  const counts: RestoredCounts = {
    users: 0, departments: 0, plans: 0, members: 0,
    payments: 0, transactions: 0, events: 0, eventRegistrations: 0,
  };

  try {
    // 1. Usuários — atualiza somente campos não-sensíveis; nunca cria novos sem senha
    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        const exists = await prisma.user.findUnique({ where: { id: u.id } });
        if (exists) {
          await prisma.user.update({
            where: { id: u.id },
            data: { name: u.name, role: u.role, approved: u.approved },
          });
          counts.users++;
        }
        // Novos usuários são ignorados — não há senha para restaurar
      }
    }

    // 2. Departamentos
    if (Array.isArray(data.departments)) {
      for (const d of data.departments) {
        await prisma.department.upsert({
          where: { id: d.id },
          update: { name: d.name, slug: d.slug, description: d.description, color: d.color, active: d.active },
          create: { id: d.id, name: d.name, slug: d.slug, description: d.description, color: d.color, active: d.active, createdAt: new Date(d.createdAt) },
        });
        counts.departments++;
      }
    }

    // 3. Planos
    if (Array.isArray(data.plans)) {
      for (const p of data.plans) {
        await prisma.plan.upsert({
          where: { id: p.id },
          update: { name: p.name, monthlyPrice: p.monthlyPrice, billingPeriod: p.billingPeriod, description: p.description, active: p.active },
          create: { id: p.id, name: p.name, monthlyPrice: p.monthlyPrice, billingPeriod: p.billingPeriod, description: p.description, active: p.active, createdAt: new Date(p.createdAt) },
        });
        counts.plans++;
      }
    }

    // 4. Permissões de departamento
    if (Array.isArray(data.deptModulePermissions)) {
      for (const p of data.deptModulePermissions) {
        const deptExists = await prisma.department.findUnique({ where: { id: p.departmentId } });
        if (!deptExists) continue;
        await prisma.deptModulePermission.upsert({
          where: { departmentId_moduleSlug: { departmentId: p.departmentId, moduleSlug: p.moduleSlug } },
          update: { canView: p.canView, canEdit: p.canEdit, canCreate: p.canCreate, canDelete: p.canDelete, canExport: p.canExport },
          create: { id: p.id, departmentId: p.departmentId, moduleSlug: p.moduleSlug, canView: p.canView, canEdit: p.canEdit, canCreate: p.canCreate, canDelete: p.canDelete, canExport: p.canExport },
        });
      }
    }

    // 5. Associados
    if (Array.isArray(data.members)) {
      for (const m of data.members) {
        await prisma.member.upsert({
          where: { id: m.id },
          update: {
            fullName: m.fullName, sex: m.sex, email: m.email, phone: m.phone,
            birthDate: new Date(m.birthDate), cpf: m.cpf, photoUrl: m.photoUrl,
            cep: m.cep, street: m.street, number: m.number, complement: m.complement,
            neighborhood: m.neighborhood, city: m.city, state: m.state,
            bloodType: m.bloodType, emergencyName: m.emergencyName, emergencyPhone: m.emergencyPhone,
            healthConditions: m.healthConditions, healthDetails: m.healthDetails,
            mountainExperience: m.mountainExperience, otherGroup: m.otherGroup, otherGroupName: m.otherGroupName,
            interestHiking: m.interestHiking, interestClimbing: m.interestClimbing, interestCourse: m.interestCourse,
            interestBike: m.interestBike, interestEcological: m.interestEcological, suggestions: m.suggestions,
            status: m.status, inactiveReason: m.inactiveReason,
            inactiveAt: m.inactiveAt ? new Date(m.inactiveAt) : null,
            deletedAt: m.deletedAt ? new Date(m.deletedAt) : null,
            planId: m.planId ?? null, instagram: m.instagram, whatsapp: m.whatsapp,
          },
          create: {
            id: m.id, registration: m.registration, fullName: m.fullName, sex: m.sex,
            email: m.email, phone: m.phone, birthDate: new Date(m.birthDate), cpf: m.cpf,
            photoUrl: m.photoUrl, cep: m.cep, street: m.street, number: m.number,
            complement: m.complement, neighborhood: m.neighborhood, city: m.city, state: m.state,
            bloodType: m.bloodType, emergencyName: m.emergencyName, emergencyPhone: m.emergencyPhone,
            healthConditions: m.healthConditions, healthDetails: m.healthDetails,
            mountainExperience: m.mountainExperience, otherGroup: m.otherGroup, otherGroupName: m.otherGroupName,
            interestHiking: m.interestHiking, interestClimbing: m.interestClimbing, interestCourse: m.interestCourse,
            interestBike: m.interestBike, interestEcological: m.interestEcological, suggestions: m.suggestions,
            status: m.status, inactiveReason: m.inactiveReason,
            inactiveAt: m.inactiveAt ? new Date(m.inactiveAt) : null,
            deletedAt: m.deletedAt ? new Date(m.deletedAt) : null,
            planId: m.planId ?? null, instagram: m.instagram, whatsapp: m.whatsapp,
            createdAt: new Date(m.createdAt),
          },
        });
        counts.members++;
      }
    }

    // 6. Pagamentos
    if (Array.isArray(data.payments)) {
      for (const p of data.payments) {
        const memberExists = await prisma.member.findUnique({ where: { id: p.memberId } });
        if (!memberExists) continue;
        await prisma.payment.upsert({
          where: { id: p.id },
          update: { amount: p.amount, referenceMonth: p.referenceMonth, referenceYear: p.referenceYear, status: p.status, dueDate: new Date(p.dueDate), paidAt: p.paidAt ? new Date(p.paidAt) : null, notes: p.notes },
          create: { id: p.id, memberId: p.memberId, planId: p.planId ?? null, amount: p.amount, referenceMonth: p.referenceMonth, referenceYear: p.referenceYear, status: p.status, dueDate: new Date(p.dueDate), paidAt: p.paidAt ? new Date(p.paidAt) : null, notes: p.notes, createdAt: new Date(p.createdAt) },
        });
        counts.payments++;
      }
    }

    // 7. Transações de caixa
    if (Array.isArray(data.transactions)) {
      for (const t of data.transactions) {
        await prisma.transaction.upsert({
          where: { id: t.id },
          update: { type: t.type, category: t.category, description: t.description, amount: t.amount, date: new Date(t.date), notes: t.notes },
          create: { id: t.id, type: t.type, category: t.category, description: t.description, amount: t.amount, date: new Date(t.date), notes: t.notes, createdAt: new Date(t.createdAt) },
        });
        counts.transactions++;
      }
    }

    // 8. Eventos
    if (Array.isArray(data.events)) {
      for (const e of data.events) {
        await prisma.event.upsert({
          where: { id: e.id },
          update: { name: e.name, description: e.description, dateTime: new Date(e.dateTime), location: e.location, difficulty: e.difficulty, slots: e.slots, status: e.status, departmentId: e.departmentId ?? null },
          create: { id: e.id, name: e.name, description: e.description, dateTime: new Date(e.dateTime), location: e.location, difficulty: e.difficulty, slots: e.slots, status: e.status, departmentId: e.departmentId ?? null, createdAt: new Date(e.createdAt) },
        });
        counts.events++;
      }
    }

    // 9. Inscrições em eventos
    if (Array.isArray(data.eventRegistrations)) {
      for (const r of data.eventRegistrations) {
        const [eventExists, memberExists] = await Promise.all([
          prisma.event.findUnique({ where: { id: r.eventId } }),
          prisma.member.findUnique({ where: { id: r.memberId } }),
        ]);
        if (!eventExists || !memberExists) continue;
        await prisma.eventRegistration.upsert({
          where: { eventId_memberId: { eventId: r.eventId, memberId: r.memberId } },
          update: {},
          create: { id: r.id, eventId: r.eventId, memberId: r.memberId, createdAt: new Date(r.createdAt) },
        });
        counts.eventRegistrations++;
      }
    }

    // 10. Configurações do sistema
    if (Array.isArray(data.systemConfig)) {
      for (const c of data.systemConfig) {
        await prisma.systemConfig.upsert({
          where: { id: c.id },
          update: { enrollmentFee: c.enrollmentFee },
          create: { id: c.id, enrollmentFee: c.enrollmentFee },
        });
      }
    }

    await recordAudit({
      userId: session?.user?.id,
      action: "CREATE",
      entity: "Restore",
      entityId: "full",
      metadata: counts,
    });

    return { ok: true, counts };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: `Falha ao restaurar: ${message}` };
  }
}

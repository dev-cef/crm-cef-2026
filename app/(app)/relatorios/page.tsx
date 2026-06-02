import { BarChart3, Download, FileSpreadsheet, FileText, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatBRL, monthName } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReportDownloadButton } from "@/components/modules/relatorios/report-download-button";
import { ActivityReportCard } from "@/components/modules/relatorios/activity-report-card";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [activeMembers, overdueCount, totalPayments, totalEvents] = await Promise.all([
    prisma.member.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.payment.count({ where: { status: "ATRASADO" } }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: "PAGO", referenceMonth: month, referenceYear: year },
    }),
    prisma.event.count({ where: { eventCategory: "ATIVIDADE", status: { not: "CANCELADO" } } }),
  ]);

  const recebidoMes = totalPayments._sum.amount ?? 0;

  const reports = [
    {
      section: "Associados",
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-500/10",
      items: [
        {
          title: "Lista de Associados",
          description: "Todos os associados ativos com dados cadastrais completos.",
          format: "XLSX",
          href: "/associados/export",
          stat: `${activeMembers} ativos`,
        },
        {
          title: "Aniversariantes",
          description: "Associados aniversariantes filtrados por mês.",
          format: "CSV",
          href: `/aniversariantes/export?month=${month}`,
          stat: `Mês atual: ${monthName(month)}`,
        },
        {
          title: "Participação em Atividades",
          description: "Histórico de quais atividades cada associado participou.",
          format: "CSV",
          href: "/relatorios/participacao",
          stat: `${totalEvents} atividades`,
          periodFilter: true,
        },
      ],
    },
    {
      section: "Financeiro",
      icon: BarChart3,
      color: "text-green-600",
      bg: "bg-green-500/10",
      items: [
        {
          title: "Pagamentos do Mês",
          description: `Cobranças e baixas de ${monthName(month)}/${year}.`,
          format: "CSV",
          href: `/financeiro/pagamentos/export?month=${month}&year=${year}`,
          stat: `Arrecadado: ${formatBRL(recebidoMes)}`,
        },
        {
          title: "Inadimplência Consolidada",
          description: "Todos os associados com pagamentos em atraso.",
          format: "CSV",
          href: "/relatorios/inadimplencia",
          stat: `${overdueCount} inadimplentes`,
          alert: overdueCount > 0,
        },
      ],
    },
    {
      section: "Atividades",
      icon: FileSpreadsheet,
      color: "text-orange-600",
      bg: "bg-orange-500/10",
      items: [
        {
          title: "Relatório de Atividades",
          description: "Lista de atividades com inscritos, presentes, guias e status.",
          format: "CSV",
          href: "/relatorios/atividades",
          stat: `${totalEvents} atividades`,
          periodFilter: true,
        },
      ],
    },
  ];

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Exportação de dados e relatórios gerenciais do clube"
      />

      <div className="space-y-8">
        {reports.map((section) => (
          <div key={section.section}>
            <div className="mb-3 flex items-center gap-2">
              <span className={`flex size-7 items-center justify-center rounded-lg ${section.bg} ${section.color}`}>
                <section.icon className="size-4" />
              </span>
              <h2 className="font-semibold">{section.section}</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => {
                // Cards de atividades têm filtro de período interativo
                if ((item as { periodFilter?: boolean }).periodFilter) {
                  return (
                    <ActivityReportCard
                      key={item.title}
                      title={item.title}
                      description={item.description}
                      baseHref={item.href}
                      stat={item.stat}
                    />
                  );
                }
                return (
                  <Card key={item.title} className="relative overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-sm font-semibold leading-snug">
                          {item.title}
                        </CardTitle>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          <FileText className="mr-1 size-3" />
                          {item.format}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {item.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between gap-2 pt-0">
                      <span className={`text-xs font-medium ${(item as { alert?: boolean }).alert ? "text-destructive" : "text-muted-foreground"}`}>
                        {item.stat}
                      </span>
                      <ReportDownloadButton href={item.href} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

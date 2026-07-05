import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle, Wallet, Paperclip, Mail, Phone, Hash, QrCode } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { formatBRL, toBrDate, toNum } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CountUp } from "@/components/unlumen-ui/count-up";
import { CardBeam } from "@/components/ui/card-beam";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      transactions: {
        orderBy: { date: "desc" },
        select: {
          id: true, type: true, category: true, subcategory: true,
          description: true, amount: true, date: true,
          attachmentUrl: true, attachmentName: true,
        },
      },
    },
  });

  if (!supplier) notFound();

  const totalSaidas   = supplier.transactions.filter(t => t.type === "SAIDA").reduce((s, t) => s + toNum(t.amount), 0);
  const totalEntradas = supplier.transactions.filter(t => t.type === "ENTRADA").reduce((s, t) => s + toNum(t.amount), 0);

  const infoItems = [
    supplier.phone    && { icon: Phone,  label: "Telefone",   value: supplier.phone },
    supplier.email    && { icon: Mail,   label: "E-mail",     value: supplier.email },
    supplier.document && { icon: Hash,   label: "CNPJ / CPF", value: supplier.document },
    supplier.pix      && { icon: QrCode, label: "PIX",        value: supplier.pix },
  ].filter(Boolean) as { icon: React.ElementType; label: string; value: string }[];

  return (
    <div>
      <Link
        href="/fornecedores"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Fornecedores
      </Link>

      <PageHeader
        title={supplier.name}
        description={supplier.type}
      >
        <Badge variant={supplier.active ? "default" : "secondary"}>
          {supplier.active ? "Ativo" : "Inativo"}
        </Badge>
      </PageHeader>

      {/* Dados do fornecedor */}
      {(infoItems.length > 0 || supplier.notes) && (
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {infoItems.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="size-3.5" />
              <span className="text-foreground">{value}</span>
            </div>
          ))}
          {supplier.notes && (
            <p className="w-full text-muted-foreground italic">{supplier.notes}</p>
          )}
        </div>
      )}

      {/* Cards de totais */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total pago (saídas)", value: totalSaidas, icon: ArrowDownCircle, color: "text-destructive" },
          { label: "Total recebido (entradas)", value: totalEntradas, icon: ArrowUpCircle, color: "text-green-600 dark:text-green-400" },
          { label: "Transações", value: supplier.transactions.length, icon: Wallet, color: "text-primary", count: true },
        ].map((s) => (
          <Card key={s.label} className="group relative overflow-hidden">
            <CardBeam />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{s.label}</CardDescription>
              <s.icon className={cn("size-4", s.color)} />
            </CardHeader>
            <CardContent>
              <p className={cn("font-display text-2xl font-semibold", s.color)}>
                {s.count ? (
                  <CountUp to={s.value} duration={1} digitEffect="none" separator="." />
                ) : (
                  <>
                    <span className="mr-1 text-base text-muted-foreground">R$</span>
                    <CountUp to={Math.round(s.value)} duration={1.2} digitEffect="none" separator="." />
                  </>
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela de transações */}
      <h2 className="mt-8 mb-3 font-semibold">Transações vinculadas</h2>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Comprovante</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {supplier.transactions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma transação vinculada a este fornecedor.
                </TableCell>
              </TableRow>
            )}
            {supplier.transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="tabular-nums text-sm">{toBrDate(t.date)}</TableCell>
                <TableCell>
                  <Badge
                    variant={t.type === "ENTRADA" ? "default" : "destructive"}
                    className={
                      t.type === "ENTRADA"
                        ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
                        : ""
                    }
                  >
                    {t.type === "ENTRADA" ? "Entrada" : "Saída"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.category}
                  {t.subcategory && <span className="block text-xs opacity-70">{t.subcategory}</span>}
                </TableCell>
                <TableCell className="text-sm">{t.description}</TableCell>
                <TableCell>
                  {t.attachmentUrl ? (
                    <a
                      href={t.attachmentUrl}
                      download={t.attachmentName ?? "comprovante"}
                      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium text-primary hover:bg-accent"
                      title={t.attachmentName ?? "comprovante"}
                    >
                      <Paperclip className="size-3.5" />
                      {t.attachmentName ?? "comprovante"}
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums",
                    t.type === "ENTRADA" ? "text-green-700 dark:text-green-400" : "text-destructive",
                  )}
                >
                  {t.type === "SAIDA" ? "−" : "+"}
                  {formatBRL(t.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

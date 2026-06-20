import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Pencil, ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { toSessionUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { getBemById } from "@/lib/patrimonio/queries";
import { calcularDepreciacao } from "@/lib/patrimonio/utils";
import { CATEGORIA_LABELS, ESTADO_LABELS } from "@/lib/patrimonio/types";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { BemStatusBadge } from "@/components/modules/patrimonio/bem-status-badge";
import { BemCategoriaBadge } from "@/components/modules/patrimonio/bem-categoria-badge";
import { MovimentacaoTimeline } from "@/components/modules/patrimonio/movimentacao-timeline";
import { BaixarBemDialog } from "@/components/modules/patrimonio/baixar-bem-dialog";
import type { MovimentacaoComRelacoes } from "@/lib/patrimonio/types";

export const dynamic = "force-dynamic";

function fmtMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function BemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bem, session] = await Promise.all([getBemById(id), auth()]);
  if (!bem) notFound();

  const sessionUser = toSessionUser(session!.user);
  const [canEdit, canDelete] = await Promise.all([
    can(sessionUser, "patrimonio", "edit"),
    can(sessionUser, "patrimonio", "delete"),
  ]);

  const movimentacoes = (bem.movimentacoes ?? []) as MovimentacaoComRelacoes[];

  const depreciado =
    bem.valorAquisicao && bem.vidaUtilAnos && bem.dataAquisicao
      ? calcularDepreciacao(
          Number(bem.valorAquisicao),
          Number(bem.valorResidual ?? 0),
          bem.vidaUtilAnos,
          new Date(bem.dataAquisicao),
        )
      : null;

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <PageHeader title={bem.nome}>
        {canEdit && bem.status !== "baixado" && (
          <div className="flex gap-2">
            <Link href={`/patrimonio/${id}/movimentar`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <ArrowLeftRight className="size-4 mr-1" /> Movimentar
            </Link>
            <Link href={`/patrimonio/${id}/editar`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Pencil className="size-4 mr-1" /> Editar
            </Link>
            {canDelete && <BaixarBemDialog id={id} nome={bem.nome} />}
          </div>
        )}
      </PageHeader>

      {/* Cabeçalho da ficha */}
      <div className="flex gap-4 rounded-xl border bg-card p-5">
        {bem.fotoUrl && (
          <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border">
            <Image src={bem.fotoUrl} alt={bem.nome} fill className="object-cover" />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <p className="font-mono text-xs text-muted-foreground">{bem.codigo}</p>
          <h1 className="text-xl font-semibold">{bem.nome}</h1>
          <div className="flex flex-wrap gap-2">
            <BemCategoriaBadge categoria={bem.categoria} />
            <BemStatusBadge status={bem.status} />
          </div>
          {bem.descricao && <p className="text-sm text-muted-foreground">{bem.descricao}</p>}
        </div>
      </div>

      {/* Dados do bem */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold mb-4">Detalhes</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          {bem.marca && <><dt className="text-muted-foreground">Marca</dt><dd className="sm:col-span-2">{bem.marca}</dd></>}
          {bem.modelo && <><dt className="text-muted-foreground">Modelo</dt><dd className="sm:col-span-2">{bem.modelo}</dd></>}
          {bem.numeroSerie && <><dt className="text-muted-foreground">Nº série</dt><dd className="sm:col-span-2">{bem.numeroSerie}</dd></>}
          <dt className="text-muted-foreground">Estado</dt>
          <dd className="sm:col-span-2">{ESTADO_LABELS[bem.estado as keyof typeof ESTADO_LABELS] ?? bem.estado}</dd>
          <dt className="text-muted-foreground">Local atual</dt>
          <dd className="sm:col-span-2">{bem.local?.nome ?? "—"}</dd>
          <dt className="text-muted-foreground">Responsável</dt>
          <dd className="sm:col-span-2">{bem.responsavel?.fullName ?? "—"}</dd>
          {bem.valorAquisicao && (
            <>
              <dt className="text-muted-foreground">Valor aquisição</dt>
              <dd className="sm:col-span-2">{fmtMoeda(Number(bem.valorAquisicao))}</dd>
            </>
          )}
          {depreciado !== null && (
            <>
              <dt className="text-muted-foreground">Valor depreciado</dt>
              <dd className="sm:col-span-2">{fmtMoeda(depreciado)}</dd>
            </>
          )}
          {bem.dataAquisicao && (
            <>
              <dt className="text-muted-foreground">Data de aquisição</dt>
              <dd className="sm:col-span-2">
                {format(new Date(bem.dataAquisicao), "dd/MM/yyyy", { locale: ptBR })}
              </dd>
            </>
          )}
          {bem.notaFiscal && <><dt className="text-muted-foreground">Nota fiscal</dt><dd className="sm:col-span-2">{bem.notaFiscal}</dd></>}
          {bem.fornecedor && <><dt className="text-muted-foreground">Fornecedor</dt><dd className="sm:col-span-2">{bem.fornecedor}</dd></>}
          {bem.observacoes && (
            <>
              <dt className="text-muted-foreground">Observações</dt>
              <dd className="sm:col-span-2 italic">{bem.observacoes}</dd>
            </>
          )}
        </dl>
      </div>

      {/* Timeline de movimentações */}
      <div className="space-y-4">
        <h2 className="font-semibold">Histórico de movimentações</h2>
        <MovimentacaoTimeline movimentacoes={movimentacoes} />
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Pencil, Trash2, BookOpen, BookMarked } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getLivroById } from "@/lib/biblioteca/queries";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ESTADO_LABELS } from "@/lib/biblioteca/types";
import { LivroDisponibilidadeBadge, LivroOrigemBadge, EmprestimoStatusBadge } from "@/components/modules/biblioteca/livro-status-badge";
import { DevolucaoDialog } from "@/components/modules/biblioteca/devolucao-dialog";
import { auth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { toSessionUser } from "@/lib/rbac";
import { differenceInDays } from "date-fns";

export const dynamic = "force-dynamic";

export default async function LivroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [livro, session] = await Promise.all([getLivroById(id), auth()]);
  if (!livro) notFound();

  const sessionUser = toSessionUser(session!.user);
  const [canEdit, canDelete] = await Promise.all([
    can(sessionUser, "biblioteca", "edit"),
    can(sessionUser, "biblioteca", "delete"),
  ]);

  const emprestimoAtivo = livro.emprestimos.find((e) => e.status === "ativo" || e.status === "atrasado");

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <PageHeader title={livro.titulo}>
        {canEdit && (
          <Link href={`/biblioteca/${id}/editar`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <Pencil className="size-4 mr-1" /> Editar
          </Link>
        )}
        {livro.disponivel && (
          <Link href={`/biblioteca/emprestimos/novo?livroId=${id}`} className={cn(buttonVariants({ size: "sm" }))}>
            <BookMarked className="size-4 mr-1" /> Emprestar
          </Link>
        )}
      </PageHeader>

      {/* Cabeçalho */}
      <div className="flex gap-5 rounded-xl border bg-card p-5">
        <div className="relative w-24 shrink-0 aspect-[3/4] rounded-lg overflow-hidden border bg-emerald-900 flex items-center justify-center">
          {livro.capaUrl ? (
            <Image src={livro.capaUrl} alt={livro.titulo} fill className="object-cover" />
          ) : (
            <span className="text-4xl font-bold text-white/30">{livro.titulo.charAt(0)}</span>
          )}
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{livro.titulo}</h1>
          {livro.autor && <p className="text-muted-foreground">{livro.autor}</p>}
          <div className="flex flex-wrap gap-2">
            <LivroDisponibilidadeBadge disponivel={livro.disponivel} />
            {livro.origem === "doacao" && <LivroOrigemBadge origem={livro.origem} doadorNome={livro.doadorNome} />}
          </div>
          {livro.descricao && <p className="text-sm text-muted-foreground mt-2">{livro.descricao}</p>}
        </div>
      </div>

      {/* Empréstimo ativo */}
      {emprestimoAtivo && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-5 space-y-3">
          <h2 className="font-semibold text-amber-800 dark:text-amber-400">Empréstimo ativo</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Sócio</p>
              <p className="font-medium">{"socio" in emprestimoAtivo ? (emprestimoAtivo as { socio: { fullName: string } }).socio.fullName : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prazo</p>
              <p className="font-medium">{format(new Date(emprestimoAtivo.prazoDevolucao), "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Retirado em</p>
              <p>{format(new Date(emprestimoAtivo.retiradoEm), "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dias até devolução</p>
              <p className={cn("font-medium", differenceInDays(new Date(emprestimoAtivo.prazoDevolucao), new Date()) < 0 ? "text-red-600" : "text-green-600")}>
                {differenceInDays(new Date(emprestimoAtivo.prazoDevolucao), new Date())} dias
              </p>
            </div>
          </div>
          <DevolucaoDialog
            emprestimoId={emprestimoAtivo.id}
            livroTitulo={livro.titulo}
            socioNome={"socio" in emprestimoAtivo ? (emprestimoAtivo as { socio: { fullName: string } }).socio.fullName : "—"}
            prazoDevolucao={new Date(emprestimoAtivo.prazoDevolucao)}
            estadoRetirada={emprestimoAtivo.estadoRetirada}
          />
        </div>
      )}

      {/* Detalhes */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold mb-4">Detalhes</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          {livro.editora && <><dt className="text-muted-foreground">Editora</dt><dd className="sm:col-span-2">{livro.editora}</dd></>}
          {livro.anoPublicacao && <><dt className="text-muted-foreground">Ano</dt><dd className="sm:col-span-2">{livro.anoPublicacao}</dd></>}
          {livro.isbn && <><dt className="text-muted-foreground">ISBN</dt><dd className="sm:col-span-2">{livro.isbn}</dd></>}
          {livro.numeroTombo && <><dt className="text-muted-foreground">Nº tombo</dt><dd className="sm:col-span-2 font-mono">{livro.numeroTombo}</dd></>}
          {livro.categoria && <><dt className="text-muted-foreground">Categoria</dt><dd className="sm:col-span-2">{livro.categoria.nome}</dd></>}
          <dt className="text-muted-foreground">Estado</dt>
          <dd className="sm:col-span-2">{ESTADO_LABELS[livro.estado as keyof typeof ESTADO_LABELS] ?? livro.estado}</dd>
          <dt className="text-muted-foreground">Origem</dt>
          <dd className="sm:col-span-2">{livro.origem === "doacao" ? "Doação" : "Próprio"}</dd>
          {livro.doadorNome && <><dt className="text-muted-foreground">Doador</dt><dd className="sm:col-span-2">{livro.doadorNome}</dd></>}
          {livro.doadorSocio && <><dt className="text-muted-foreground">Sócio doador</dt><dd className="sm:col-span-2">{livro.doadorSocio.fullName}</dd></>}
          {livro.observacoes && <><dt className="text-muted-foreground">Observações</dt><dd className="sm:col-span-2 italic">{livro.observacoes}</dd></>}
        </dl>
      </div>

      {/* Fila de reservas */}
      {livro.reservas.length > 0 && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h2 className="font-semibold">Fila de reservas ({livro.reservas.length})</h2>
          <ol className="space-y-2">
            {livro.reservas.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 text-sm">
                <span className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{i + 1}</span>
                <span>{"socio" in r ? (r as { socio: { fullName: string } }).socio.fullName : "—"}</span>
                <span className="text-muted-foreground text-xs">
                  {format(new Date(r.reservadoEm), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Histórico de empréstimos */}
      <div className="rounded-xl border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Histórico de empréstimos ({livro.emprestimos.length})</h2>
        {livro.emprestimos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum empréstimo registrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left pb-2">Sócio</th>
                  <th className="text-left pb-2">Retirado</th>
                  <th className="text-left pb-2">Prazo</th>
                  <th className="text-left pb-2">Devolvido</th>
                  <th className="text-left pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {livro.emprestimos.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2">{"socio" in e ? (e as { socio: { fullName: string } }).socio.fullName : "—"}</td>
                    <td className="py-2">{format(new Date(e.retiradoEm), "dd/MM/yyyy", { locale: ptBR })}</td>
                    <td className="py-2">{format(new Date(e.prazoDevolucao), "dd/MM/yyyy", { locale: ptBR })}</td>
                    <td className="py-2">{e.devolvidoEm ? format(new Date(e.devolvidoEm), "dd/MM/yyyy", { locale: ptBR }) : "—"}</td>
                    <td className="py-2"><EmprestimoStatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

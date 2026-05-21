import { redirect } from "next/navigation";
import Link from "next/link";
import { Search, IdCard } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { scopedMemberWhere } from "@/lib/rbac";
import { stripCpf } from "@/lib/cpf";
import { membershipNumber } from "@/lib/membership";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CarteirinhaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const session = await auth();
  const user = session?.user;

  if (user?.role === "ASSOCIADO") {
    const own = await prisma.member.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (own) redirect(`/carteirinha/${own.id}`);
  }

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status =
    sp.status === "ACTIVE" || sp.status === "INACTIVE" ? sp.status : "ALL";

  const scope = scopedMemberWhere({ id: user!.id, role: user!.role as "ADMIN" | "DEPARTAMENTO" | "ASSOCIADO", memberId: user!.memberId ?? null, departmentIds: user!.departmentIds ?? [] });
  const where: Record<string, unknown> = { deletedAt: null, ...scope };
  if (status !== "ALL") where.status = status;
  if (q) {
    const digits = stripCpf(q);
    where.OR = [
      { fullName: { contains: q } },
      ...(digits ? [{ cpf: { contains: digits } }] : []),
    ];
  }

  const members = await prisma.member.findMany({
    where,
    include: { plan: true },
    orderBy: { fullName: "asc" },
    take: 60,
  });

  function buildHref(s: string, search?: string) {
    const p = new URLSearchParams();
    if (s !== "ALL") p.set("status", s);
    if (search ?? q) p.set("q", search ?? q);
    const qs = p.toString();
    return `/carteirinha${qs ? `?${qs}` : ""}`;
  }

  const chips = [
    { value: "ALL", label: "Todos" },
    { value: "ACTIVE", label: "Ativos" },
    { value: "INACTIVE", label: "Inativos" },
  ] as const;

  return (
    <div>
      <PageHeader
        title="Carteirinha"
        description="Selecione um associado para gerar a carteirinha digital"
      />

      {/* Busca + filtro */}
      <form method="get" className="mb-4 flex gap-2">
        {status !== "ALL" && (
          <input type="hidden" name="status" value={status} />
        )}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome ou CPF"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          Buscar
        </Button>
      </form>

      {/* Chips de status */}
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c) => (
          <Link
            key={c.value}
            href={buildHref(c.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              status === c.value
                ? c.value === "ACTIVE"
                  ? "border-green-600 bg-green-600/10 text-green-700 dark:text-green-400"
                  : c.value === "INACTIVE"
                    ? "border-muted-foreground/50 bg-muted text-muted-foreground"
                    : "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent",
            )}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {members.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum associado encontrado.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <Link key={m.id} href={`/carteirinha/${m.id}`}>
              <Card
                className={cn(
                  "transition-colors hover:bg-accent/40",
                  m.status === "INACTIVE" && "opacity-60",
                )}
              >
                <CardContent className="flex items-center gap-3 py-4">
                  <Avatar className="size-12">
                    {m.photoUrl && (
                      <AvatarImage src={m.photoUrl} alt={m.fullName} />
                    )}
                    <AvatarFallback>
                      {m.fullName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {membershipNumber(m.registration)} ·{" "}
                      {m.plan?.name ?? "Sem plano"}
                    </p>
                    <Badge
                      variant={m.status === "ACTIVE" ? "default" : "secondary"}
                      className={cn(
                        "mt-1 text-[10px]",
                        m.status === "ACTIVE"
                          ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400"
                          : "",
                      )}
                    >
                      {m.status === "ACTIVE" ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <IdCard className="size-5 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

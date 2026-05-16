import Link from "next/link";
import { Search, IdCard } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { stripCpf } from "@/lib/cpf";
import { membershipNumber } from "@/lib/membership";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CarteirinhaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const where: Record<string, unknown> = { deletedAt: null };
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

  return (
    <div>
      <PageHeader
        title="Carteirinha"
        description="Selecione um associado para gerar a carteirinha digital"
      />

      <form method="get" className="mb-4 flex gap-2">
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

      {members.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nenhum associado encontrado.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <Link key={m.id} href={`/carteirinha/${m.id}`}>
              <Card className="transition-colors hover:bg-accent/40">
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

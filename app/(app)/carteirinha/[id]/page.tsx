import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { maskCpf } from "@/lib/cpf";
import { formatDate } from "@/lib/format";
import {
  membershipNumber,
  membershipValidity,
  validationUrl,
} from "@/lib/membership";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { MembershipCard } from "@/components/modules/carteirinha/membership-card";

export const dynamic = "force-dynamic";

export default async function CarteirinhaMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const member = await prisma.member.findFirst({
    where: { id, deletedAt: null },
    include: { plan: true },
  });
  if (!member) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = validationUrl(member.id, `${proto}://${host}`);
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 200 });

  return (
    <div>
      <Link
        href="/carteirinha"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-3")}
      >
        <ArrowLeft className="size-4" /> Voltar
      </Link>

      <PageHeader
        title="Carteirinha digital"
        description={member.fullName}
      />

      <MembershipCard
        fullName={member.fullName}
        maskedCpf={maskCpf(member.cpf)}
        membershipNo={membershipNumber(member.registration)}
        planName={member.plan?.name ?? "Sem plano"}
        validity={formatDate(membershipValidity())}
        photoUrl={member.photoUrl}
        qrDataUrl={qrDataUrl}
        validationUrl={url}
      />
    </div>
  );
}

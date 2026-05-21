import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { maskCpf } from "@/lib/cpf";
import { formatDate } from "@/lib/format";
import { membershipNumber, membershipValidity, validationUrl } from "@/lib/membership";
import { googleWalletEnabled } from "@/lib/wallet";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!googleWalletEnabled()) {
    return NextResponse.json(
      { error: "Google Wallet não configurado." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const member = await prisma.member.findFirst({
    where: { id, deletedAt: null },
    include: { plan: true },
  });
  if (!member) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const qr = validationUrl(member.id, origin);
  const validity = formatDate(member.cardValidUntil ?? membershipValidity());
  const memNo = membershipNumber(member.registration);

  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX ?? "cef-carteirinha";
  const classId = `${issuerId}.${classSuffix}`;
  const objectId = `${issuerId}.${member.id.replace(/-/g, "_")}`;

  const serviceAccountJson = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!, "base64").toString("utf-8"),
  ) as { private_key: string };
  const serviceAccountKey = serviceAccountJson.private_key;

  const genericObject = {
    id: objectId,
    classId,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    hexBackgroundColor: "#166534",
    logo: {
      sourceUri: {
        uri: `${origin}/assets/wallet/cef-logo-white.png`,
      },
      contentDescription: {
        defaultValue: { language: "pt-BR", value: "Logo CEF" },
      },
    },
    cardTitle: {
      defaultValue: {
        language: "pt-BR",
        value: "Centro Excursionista Friburguense",
      },
    },
    subheader: {
      defaultValue: { language: "pt-BR", value: "Carteirinha de Sócio" },
    },
    header: {
      defaultValue: { language: "pt-BR", value: member.fullName },
    },
    textModulesData: [
      {
        id: "membership",
        header: "MATRÍCULA",
        body: memNo,
      },
      {
        id: "plan",
        header: "PLANO",
        body: member.plan?.name ?? "Sem plano",
      },
      {
        id: "cpf",
        header: "CPF",
        body: maskCpf(member.cpf),
      },
      {
        id: "validity",
        header: "VALIDADE",
        body: validity,
      },
    ],
    barcode: {
      type: "QR_CODE",
      value: qr,
      alternateText: memNo,
    },
    state: member.status === "ACTIVE" ? "ACTIVE" : "EXPIRED",
  };

  const payload = {
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: {
      genericObjects: [genericObject],
    },
    origins: [origin],
  };

  const token = jwt.sign(payload, serviceAccountKey, { algorithm: "RS256" });
  const walletUrl = `https://pay.google.com/gp/v/save/${token}`;

  return NextResponse.redirect(walletUrl, { status: 302 });
}

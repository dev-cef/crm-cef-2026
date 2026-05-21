import { NextRequest, NextResponse } from "next/server";
import { PKPass } from "passkit-generator";
import { prisma } from "@/lib/prisma";
import { maskCpf } from "@/lib/cpf";
import { formatDate } from "@/lib/format";
import { membershipNumber, membershipValidity, validationUrl } from "@/lib/membership";
import { appleWalletEnabled } from "@/lib/wallet";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!appleWalletEnabled()) {
    return NextResponse.json(
      { error: "Apple Wallet não configurado neste servidor." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const member = await prisma.member.findFirst({
    where: { id, deletedAt: null },
    include: { plan: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Associado não encontrado." }, { status: 404 });
  }

  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const qr = validationUrl(member.id, origin);
  const validity = formatDate(member.cardValidUntil ?? membershipValidity());
  const memNo = membershipNumber(member.registration);

  const certPem = Buffer.from(process.env.APPLE_CERT_PEM!, "base64").toString("utf-8");
  const keyPem = Buffer.from(process.env.APPLE_KEY_PEM!, "base64").toString("utf-8");
  const wwdrPem = Buffer.from(process.env.APPLE_WWDR_PEM!, "base64").toString("utf-8");

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
    serialNumber: memNo,
    teamIdentifier: process.env.APPLE_TEAM_ID!,
    organizationName: "Centro Excursionista Friburguense",
    description: "Carteirinha de Sócio CEF",
    logoText: "CEF",
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(22, 101, 52)",
    labelColor: "rgb(187, 247, 208)",
    generic: {
      primaryFields: [
        { key: "name", label: "SÓCIO", value: member.fullName },
      ],
      secondaryFields: [
        { key: "membership", label: "MATRÍCULA", value: memNo },
        { key: "plan", label: "PLANO", value: member.plan?.name ?? "Sem plano" },
      ],
      auxiliaryFields: [
        { key: "validity", label: "VALIDADE", value: validity },
        { key: "cpf", label: "CPF", value: maskCpf(member.cpf) },
      ],
      backFields: [
        {
          key: "info",
          label: "Centro Excursionista Friburguense",
          value:
            "Carteirinha de uso pessoal e intransferível. Aponte a câmera para o QR Code para validar.",
        },
      ],
    },
    barcodes: [
      {
        message: qr,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
        altText: memNo,
      },
    ],
    barcode: {
      message: qr,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
    },
  };

  const pass = new PKPass(
    { "pass.json": Buffer.from(JSON.stringify(passJson)) },
    { signerCert: certPem, signerKey: keyPem, wwdr: wwdrPem },
  );

  const buf = pass.getAsBuffer();

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.apple.pkpass",
      "Content-Disposition": `attachment; filename="carteirinha-${memNo}.pkpass"`,
    },
  });
}

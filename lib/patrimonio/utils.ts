import { prisma } from "@/lib/prisma";

export async function gerarCodigoBem(): Promise<string> {
  const ano = new Date().getFullYear();
  const prefix = `CEF-${ano}-`;
  const ultimo = await prisma.patrimonioBem.findFirst({
    where: { codigo: { startsWith: prefix } },
    orderBy: { codigo: "desc" },
    select: { codigo: true },
  });
  const seq = ultimo ? parseInt(ultimo.codigo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export function calcularDepreciacao(
  valorAquisicao: number,
  valorResidual: number,
  vidaUtilAnos: number,
  dataAquisicao: Date,
): number {
  const anosDecorridos =
    (Date.now() - dataAquisicao.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const fator = Math.min(anosDecorridos / vidaUtilAnos, 1);
  return valorAquisicao - (valorAquisicao - valorResidual) * fator;
}

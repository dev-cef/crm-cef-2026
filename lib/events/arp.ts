import { prisma } from "@/lib/prisma";
import { ARP_COUNTERPART_CODES, ARP_META_DEFAULT } from "@/lib/constants";

export type MetaArpStatus = "abaixo" | "em_risco" | "atingida";

export interface ResultadoMetaArp {
  ano: number;
  meta: number;
  realizados: number;
  percentual: number;
  excedente: number;
  status: MetaArpStatus;
}

export function calcularMetaArp(
  realizados: number,
  ano: number,
  meta: number = ARP_META_DEFAULT,
): ResultadoMetaArp {
  const percentual = +((realizados * 100) / meta).toFixed(1);
  const excedente = Math.max(0, realizados - meta);
  const status: MetaArpStatus =
    realizados >= meta
      ? "atingida"
      : realizados >= meta * 0.7
        ? "em_risco"
        : "abaixo";
  return { ano, meta, realizados, percentual, excedente, status };
}

export async function getMetaArpAno(
  ano: number = new Date().getFullYear(),
): Promise<ResultadoMetaArp> {
  const inicio = new Date(ano, 0, 1);
  const fim = new Date(ano + 1, 0, 1);

  const realizados = await prisma.event.count({
    where: {
      categoryCode: { in: [...ARP_COUNTERPART_CODES] },
      status: "REALIZADO",
      dateTime: { gte: inicio, lt: fim },
    },
  });

  return calcularMetaArp(realizados, ano);
}

import { describe, it, expect } from "vitest";
import { toNum, formatBRL, calculateAge, parseBrDate, toBrDate } from "@/lib/format";

// Simula um Prisma.Decimal: objeto cujo toString/valueOf devolve o número.
function fakeDecimal(v: string) {
  return { toString: () => v, valueOf: () => v };
}

describe("toNum (normaliza Decimal | number)", () => {
  it("passa números adiante", () => {
    expect(toNum(50)).toBe(50);
    expect(toNum(0)).toBe(0);
    expect(toNum(12.34)).toBe(12.34);
  });

  it("null/undefined viram 0", () => {
    expect(toNum(null)).toBe(0);
    expect(toNum(undefined)).toBe(0);
  });

  it("coage objeto Decimal-like para number", () => {
    expect(toNum(fakeDecimal("80.00"))).toBe(80);
    expect(toNum(fakeDecimal("25.50"))).toBe(25.5);
  });
});

describe("formatBRL", () => {
  it("formata number em BRL", () => {
    //   = espaço não-quebrável usado pelo Intl pt-BR
    expect(formatBRL(50)).toBe("R$ 50,00");
    expect(formatBRL(1234.5)).toBe("R$ 1.234,50");
  });

  it("aceita Decimal-like e null", () => {
    expect(formatBRL(fakeDecimal("80.00"))).toBe("R$ 80,00");
    expect(formatBRL(null)).toBe("R$ 0,00");
  });
});

describe("parseBrDate / toBrDate", () => {
  it("faz round-trip de datas válidas", () => {
    const d = parseBrDate("05/07/2026");
    expect(d).not.toBeNull();
    expect(toBrDate(d!)).toBe("05/07/2026");
  });

  it("rejeita datas inválidas", () => {
    expect(parseBrDate("31/02/2026")).toBeNull();
    expect(parseBrDate("2026-07-05")).toBeNull();
    expect(parseBrDate("abc")).toBeNull();
  });
});

describe("calculateAge", () => {
  it("calcula idade a partir de data UTC", () => {
    const twenty = new Date();
    twenty.setUTCFullYear(twenty.getUTCFullYear() - 20);
    expect(calculateAge(twenty)).toBe(20);
  });
});

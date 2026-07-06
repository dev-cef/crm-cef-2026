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
  it("calcula idade quando o aniversário do ano já passou", () => {
    // Nascido em 15/03/2000. Como hoje é sempre depois de março no ano
    // corrente (exceto jan–fev), a idade é anoAtual - 2000. Data fixa longe
    // de julho e da virada de ano evita flakiness de fuso.
    const birth = new Date(Date.UTC(2000, 2, 15));
    const currentYear = new Date().getFullYear();
    const expected = currentYear - 2000 - (new Date().getMonth() < 2 ? 1 : 0);
    expect(calculateAge(birth)).toBe(expected);
  });
});

import { describe, it, expect } from "vitest";
import { decideRateLimit } from "@/lib/rate-limit";

const cfg = { limit: 3, windowMs: 1000 };

describe("decideRateLimit (fixed window)", () => {
  it("primeira requisição (sem registro) inicia a janela e permite", () => {
    const d = decideRateLimit(null, 1000, cfg);
    expect(d).toEqual({ allowed: true, nextCount: 1, resetWindow: true, retryAfterMs: 0 });
  });

  it("incrementa dentro da janela enquanto abaixo do limite", () => {
    const d = decideRateLimit({ count: 1, windowStart: 1000 }, 1200, cfg);
    expect(d.allowed).toBe(true);
    expect(d.nextCount).toBe(2);
    expect(d.resetWindow).toBe(false);
  });

  it("nega ao atingir o limite dentro da janela e informa retryAfter", () => {
    const d = decideRateLimit({ count: 3, windowStart: 1000 }, 1400, cfg);
    expect(d.allowed).toBe(false);
    expect(d.retryAfterMs).toBe(600); // 1000 - (1400 - 1000)
  });

  it("reinicia a janela quando ela já expirou, mesmo estourado", () => {
    const d = decideRateLimit({ count: 99, windowStart: 1000 }, 2000, cfg);
    expect(d.allowed).toBe(true);
    expect(d.resetWindow).toBe(true);
    expect(d.nextCount).toBe(1);
  });

  it("limite=janela exata conta como expirada (>=)", () => {
    const d = decideRateLimit({ count: 3, windowStart: 1000 }, 2000, cfg);
    expect(d.allowed).toBe(true);
    expect(d.resetWindow).toBe(true);
  });
});

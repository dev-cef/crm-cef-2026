import { describe, it, expect } from "vitest";
import {
  normalizeRole,
  hasAtLeast,
  isAdmin,
  toSessionUser,
  scopedMemberWhere,
  scopedEventWhere,
  isRouteAllowed,
  homePathForRole,
  ROLE_LEVEL,
} from "@/lib/rbac";

describe("normalizeRole (fail-closed)", () => {
  it("aceita os papéis válidos", () => {
    expect(normalizeRole("ADMIN")).toBe("ADMIN");
    expect(normalizeRole("DEPARTAMENTO")).toBe("DEPARTAMENTO");
    expect(normalizeRole("ASSOCIADO")).toBe("ASSOCIADO");
  });

  it("cai no MENOR privilégio (ASSOCIADO), nunca ADMIN, para entrada inválida", () => {
    // Regressão do P0: um token/campo corrompido não pode virar administrador.
    expect(normalizeRole(undefined)).toBe("ASSOCIADO");
    expect(normalizeRole(null)).toBe("ASSOCIADO");
    expect(normalizeRole("")).toBe("ASSOCIADO");
    expect(normalizeRole("SUPERADMIN")).toBe("ASSOCIADO");
    expect(normalizeRole("admin")).toBe("ASSOCIADO"); // case-sensitive
    expect(normalizeRole(42)).toBe("ASSOCIADO");
    expect(normalizeRole({})).toBe("ASSOCIADO");
  });
});

describe("hasAtLeast / isAdmin", () => {
  it("respeita a hierarquia ADMIN > DEPARTAMENTO > ASSOCIADO", () => {
    expect(ROLE_LEVEL.ADMIN).toBeGreaterThan(ROLE_LEVEL.DEPARTAMENTO);
    expect(ROLE_LEVEL.DEPARTAMENTO).toBeGreaterThan(ROLE_LEVEL.ASSOCIADO);
  });

  it("hasAtLeast compara níveis corretamente", () => {
    expect(hasAtLeast({ role: "ADMIN" }, "DEPARTAMENTO")).toBe(true);
    expect(hasAtLeast({ role: "DEPARTAMENTO" }, "DEPARTAMENTO")).toBe(true);
    expect(hasAtLeast({ role: "ASSOCIADO" }, "DEPARTAMENTO")).toBe(false);
    expect(hasAtLeast({ role: "DEPARTAMENTO" }, "ADMIN")).toBe(false);
  });

  it("hasAtLeast trata role inválida como ASSOCIADO (fail-closed)", () => {
    expect(hasAtLeast({ role: "hacker" }, "DEPARTAMENTO")).toBe(false);
    expect(hasAtLeast(null, "ASSOCIADO")).toBe(true);
    expect(hasAtLeast(undefined, "DEPARTAMENTO")).toBe(false);
  });

  it("isAdmin só é verdadeiro para ADMIN literal", () => {
    expect(isAdmin({ role: "ADMIN" })).toBe(true);
    expect(isAdmin({ role: "DEPARTAMENTO" })).toBe(false);
    expect(isAdmin({ role: "lixo" })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("toSessionUser", () => {
  it("preenche defaults seguros para campos ausentes", () => {
    const u = toSessionUser({});
    expect(u.id).toBe("");
    expect(u.role).toBe("ASSOCIADO");
    expect(u.memberId).toBeNull();
    expect(u.departmentIds).toEqual([]);
  });

  it("normaliza role desconhecida", () => {
    expect(toSessionUser({ id: "x", role: "???" }).role).toBe("ASSOCIADO");
  });
});

describe("scopedMemberWhere (isolamento de dados)", () => {
  const base = { id: "u1", memberId: "m1", departmentIds: [] as string[] };

  it("ASSOCIADO só enxerga o próprio registro (userId)", () => {
    expect(scopedMemberWhere({ ...base, role: "ASSOCIADO" })).toEqual({ userId: "u1" });
  });

  it("ADMIN e DEPARTAMENTO não têm filtro extra", () => {
    expect(scopedMemberWhere({ ...base, role: "ADMIN" })).toEqual({});
    expect(scopedMemberWhere({ ...base, role: "DEPARTAMENTO" })).toEqual({});
  });
});

describe("scopedEventWhere", () => {
  it("DEPARTAMENTO restringe aos próprios departamentos", () => {
    expect(
      scopedEventWhere({ id: "u", memberId: null, role: "DEPARTAMENTO", departmentIds: ["d1", "d2"] }),
    ).toEqual({ departmentId: { in: ["d1", "d2"] } });
  });

  it("ADMIN e ASSOCIADO não filtram por departamento", () => {
    expect(scopedEventWhere({ id: "u", memberId: null, role: "ADMIN", departmentIds: [] })).toEqual({});
    expect(scopedEventWhere({ id: "u", memberId: "m", role: "ASSOCIADO", departmentIds: [] })).toEqual({});
  });
});

describe("isRouteAllowed (gate de rota por papel)", () => {
  it("ADMIN acessa tudo", () => {
    expect(isRouteAllowed("/configuracoes/seguranca", "ADMIN")).toBe(true);
    expect(isRouteAllowed("/financeiro", "ADMIN")).toBe(true);
  });

  it("ASSOCIADO é barrado nas áreas de staff", () => {
    expect(isRouteAllowed("/financeiro", "ASSOCIADO")).toBe(false);
    expect(isRouteAllowed("/associados", "ASSOCIADO")).toBe(false);
    expect(isRouteAllowed("/configuracoes", "ASSOCIADO")).toBe(false);
    expect(isRouteAllowed("/patrimonio", "ASSOCIADO")).toBe(false);
  });

  it("ASSOCIADO acessa suas áreas próprias", () => {
    expect(isRouteAllowed("/meu-espaco", "ASSOCIADO")).toBe(true);
    expect(isRouteAllowed("/carteirinha", "ASSOCIADO")).toBe(true);
    expect(isRouteAllowed("/eventos", "ASSOCIADO")).toBe(true);
  });

  it("DEPARTAMENTO é barrado só em /configuracoes", () => {
    expect(isRouteAllowed("/configuracoes", "DEPARTAMENTO")).toBe(false);
    expect(isRouteAllowed("/financeiro", "DEPARTAMENTO")).toBe(true);
    expect(isRouteAllowed("/dashboard", "DEPARTAMENTO")).toBe(true);
  });

  it("casa por prefixo (subrotas herdam a regra do pai)", () => {
    expect(isRouteAllowed("/financeiro/pagamentos/123", "ASSOCIADO")).toBe(false);
    expect(isRouteAllowed("/configuracoes/backup", "DEPARTAMENTO")).toBe(false);
  });

  it("rota não mapeada não bloqueia (telas neutras)", () => {
    expect(isRouteAllowed("/qualquer-coisa", "ASSOCIADO")).toBe(true);
  });
});

describe("homePathForRole", () => {
  it("ASSOCIADO vai para /meu-espaco; demais para /dashboard", () => {
    expect(homePathForRole("ASSOCIADO")).toBe("/meu-espaco");
    expect(homePathForRole("ADMIN")).toBe("/dashboard");
    expect(homePathForRole("DEPARTAMENTO")).toBe("/dashboard");
  });
});

import { test, expect } from "@playwright/test";
import { login, SEED } from "./helpers";

// Valida o gate de rotas por papel (P0 da auditoria: lib/rbac isRouteAllowed +
// proxy). O redirecionamento acontece no middleware (JWT), sem escrita no banco.

const STAFF_ROUTES = [
  "/dashboard",
  "/financeiro",
  "/associados",
  "/configuracoes",
  "/patrimonio",
  "/eventos",
];

test.describe("proteção de rotas — não autenticado", () => {
  for (const route of STAFF_ROUTES) {
    test(`redireciona ${route} para /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

test.describe("proteção de rotas — associado", () => {
  test("associado é barrado nas áreas de staff e cai no seu espaço", async ({ page }) => {
    await login(page, SEED.associadoEmail, SEED.password);

    // Áreas de staff redirecionam o associado (isRouteAllowed = false).
    await page.goto("/financeiro");
    await expect(page).not.toHaveURL(/\/financeiro/);

    await page.goto("/configuracoes");
    await expect(page).not.toHaveURL(/\/configuracoes/);

    // Sua própria área é acessível.
    await page.goto("/meu-espaco");
    await expect(page).toHaveURL(/\/meu-espaco/);
  });
});

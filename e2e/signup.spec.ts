import { test, expect } from "@playwright/test";
import { CPF_TESTE } from "./helpers";

// Auto-cadastro público (app/criar-conta). O formulário é multi-step (5 etapas)
// com validação por etapa.

test.describe("cadastro de associado", () => {
  test("a etapa 1 renderiza com barra de progresso e campos obrigatórios", async ({ page }) => {
    await page.goto("/criar-conta");
    await expect(page.getByText("Etapa 1 de 5")).toBeVisible();
    await expect(page.getByLabel("Nome completo *")).toBeVisible();
    await expect(page.getByRole("button", { name: /Próximo/ })).toBeVisible();
  });

  test("a validação bloqueia avançar com campos vazios", async ({ page }) => {
    await page.goto("/criar-conta");
    await page.getByRole("button", { name: /Próximo/ }).click();
    // Sem preencher os obrigatórios, continua na etapa 1.
    await expect(page.getByText("Etapa 1 de 5")).toBeVisible();
  });

  // Fluxo completo de escrita — cria uma conta ASSOCIADO pendente. Requer banco
  // de teste (o globalSetup bloqueia produção). Marcado como fixme porque as
  // etapas 2–5 podem ter obrigatórios que variam com o schema; complete/valide
  // os seletores contra o seu banco de teste e remova o `.fixme`.
  test.fixme("cadastro completo cria conta pendente de aprovação", async ({ page }) => {
    const unique = Date.now();
    await page.goto("/criar-conta");

    await page.getByLabel("Nome completo *").fill("Associado E2E");
    await page.getByLabel("E-mail *").fill(`e2e.${unique}@teste.com`);
    await page.getByLabel(/Telefone/).fill("22999998888");
    await page.getByLabel(/nascimento/i).fill("01/01/1990");
    await page.getByLabel("CPF *").fill(CPF_TESTE);
    await page.locator("#signupPw").fill("SenhaForte123!");
    await page.locator("#signupPw2").fill("SenhaForte123!");

    // Avança as 5 etapas (ajuste caso etapas intermediárias exijam campos).
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: /Próximo/ }).click();
    }
    await page.getByRole("button", { name: /Enviar cadastro/ }).click();

    await expect(page.getByText(/aprova/i)).toBeVisible();
  });
});

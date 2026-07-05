import { test, expect } from "@playwright/test";
import { CPF_TESTE } from "./helpers";

// Auto-cadastro público (app/criar-conta). Formulário multi-step (5 etapas) com
// validação por etapa. Selects (sexo/estado/tipo sanguíneo) são <select> nativos
// e já vêm com defaults válidos (sexo=M, cidade=Nova Friburgo, estado=RJ,
// tipo=Não sei, experiência=Nunca, interesses=3), então só preciso preencher os
// obrigatórios ainda vazios de cada etapa.

test.describe("cadastro de associado", () => {
  test("a etapa 1 renderiza com barra de progresso e campos obrigatórios", async ({ page }) => {
    await page.goto("/criar-conta");
    await expect(page.getByText("Etapa 1 de 5")).toBeVisible();
    await expect(page.locator("#fullName")).toBeVisible();
    await expect(page.getByRole("button", { name: /Próximo/ })).toBeVisible();
  });

  test("a validação bloqueia avançar com campos vazios", async ({ page }) => {
    await page.goto("/criar-conta");
    await page.getByRole("button", { name: /Próximo/ }).click();
    // Sem preencher os obrigatórios, continua na etapa 1.
    await expect(page.getByText("Etapa 1 de 5")).toBeVisible();
  });

  test("cadastro completo cria conta pendente de aprovação", async ({ page }) => {
    const unique = Date.now();
    await page.goto("/criar-conta");

    // Etapa 1 — Informações Pessoais (sexo=M já é default válido).
    await page.locator("#fullName").fill("Associado E2E Teste");
    await page.locator("#email").fill(`e2e.${unique}@teste.com`);
    await page.locator("#phone").fill("22999998888");
    await page.locator("#birthDate").fill("01/01/1990");
    await page.locator("#cpf").fill(CPF_TESTE);
    await page.locator("#signupPw").fill("SenhaForteE2E1!");
    await page.locator("#signupPw2").fill("SenhaForteE2E1!");
    await page.getByRole("button", { name: /Próximo/ }).click();

    // Etapa 2 — Endereço (cidade/estado já default). O CEP pode acionar o
    // preenchimento via ViaCEP; preencho os obrigatórios de qualquer forma.
    await expect(page.getByText("Etapa 2 de 5")).toBeVisible();
    await page.locator("#cep").fill("28610-000");
    await page.locator("#street").fill("Rua de Teste");
    await page.locator("#number").fill("100");
    await page.locator("#neighborhood").fill("Centro");
    await page.getByRole("button", { name: /Próximo/ }).click();

    // Etapa 3 — Saúde e Emergência (tipo sanguíneo default = Não sei).
    await expect(page.getByText("Etapa 3 de 5")).toBeVisible();
    await page.locator("#emergencyName").fill("Contato Emergencia");
    await page.locator("#emergencyPhone").fill("22988887777");
    await page.getByRole("button", { name: /Próximo/ }).click();

    // Etapa 4 — Experiência (mountainExperience default = Nunca): só avança.
    await expect(page.getByText("Etapa 4 de 5")).toBeVisible();
    await page.getByRole("button", { name: /Próximo/ }).click();

    // Etapa 5 — Interesses (todos default = 3): envia.
    await expect(page.getByText("Etapa 5 de 5")).toBeVisible();
    await page.getByRole("button", { name: /Enviar cadastro/ }).click();

    // Sucesso → redireciona para o login com marcador de cadastro concluído.
    await expect(page).toHaveURL(/\/login\?cadastro=ok/);
  });
});

import { test, expect } from "@playwright/test";
import { login, SEED } from "./helpers";

// Lançamento de mensalidade (staff). Requer banco de teste com admin semeado.

test.describe("financeiro — pagamentos", () => {
  test("admin acessa a página de pagamentos e vê o controle de lançar", async ({ page }) => {
    await login(page, SEED.adminEmail, SEED.password);
    await page.goto("/financeiro/pagamentos");

    await expect(page).toHaveURL(/\/financeiro\/pagamentos/);
    await expect(page.getByRole("button", { name: /Lançar mensalidade/ })).toBeVisible();
  });

  // Fluxo de escrita — lança as mensalidades do mês (cria/pula Payments).
  // Idempotente: rodar duas vezes resulta em "Nenhuma nova mensalidade".
  test("admin lança as mensalidades do mês", async ({ page }) => {
    await login(page, SEED.adminEmail, SEED.password);
    await page.goto("/financeiro/pagamentos");

    await page.getByRole("button", { name: /Lançar mensalidade/ }).first().click();

    // Diálogo "Lançar mensalidade" abre — confirma.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar" }).click();

    // Toast de sucesso (sonner): N lançadas OU nenhuma nova (já lançadas).
    await expect(
      page.getByText(/mensalidade\(s\) lançada|Nenhuma nova mensalidade/),
    ).toBeVisible();
  });
});

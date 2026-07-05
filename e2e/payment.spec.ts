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

  // Fluxo de escrita — lança as mensalidades do mês. Cria Payments no banco;
  // rode contra banco de teste. Marcado fixme até validar os seletores do
  // diálogo de confirmação contra o seu ambiente.
  test.fixme("admin lança as mensalidades do mês", async ({ page }) => {
    await login(page, SEED.adminEmail, SEED.password);
    await page.goto("/financeiro/pagamentos");

    await page.getByRole("button", { name: /Lançar mensalidade/ }).click();
    // Diálogo "Lançar mensalidade" abre — confirma.
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: /Lançar|Confirmar/ }).click();

    // Toast de sucesso (sonner).
    await expect(page.getByText(/mensalidade\(s\) lançada|Nenhuma nova mensalidade/)).toBeVisible();
  });
});

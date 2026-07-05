import { test, expect } from "@playwright/test";
import { login, SEED } from "./helpers";

test.describe("login", () => {
  test("a página de login renderiza o formulário", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
  });

  test("credenciais inválidas mostram erro e não autenticam", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("naoexiste@cef.org.br");
    await page.getByLabel("Senha").fill("senhaErrada123456");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByRole("alert")).toContainText(/inválid/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin autentica e chega ao dashboard", async ({ page }) => {
    await login(page, SEED.adminEmail, SEED.password);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

import { expect, type Page } from "@playwright/test";

// Credenciais do seed (prisma/seed.ts). Só existem no banco de teste após
// `npm run seed`.
export const SEED = {
  adminEmail: "admin@cef.org.br",
  associadoEmail: "associado@cef.org.br",
  password: "59bMtAu$I6qPoYcE",
};

// CPF válido (dígitos verificadores corretos) para o cadastro. Não pertence a
// ninguém real — é um CPF de teste clássico.
export const CPF_TESTE = "52998224725";

// Faz login por e-mail/senha e espera o redirecionamento pós-login.
// Assume conta sem 2FA (os admins do seed não têm TOTP habilitado).
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Sai da /login ao autenticar.
  await expect(page).not.toHaveURL(/\/login/);
}

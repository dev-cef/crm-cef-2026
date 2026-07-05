import "dotenv/config";

// Trava de segurança: E2E cria/edita dados (cadastro, pagamento). Rodar contra
// o banco de PRODUÇÃO poluiria os dados reais do clube. Este setup aborta a
// suíte se DATABASE_URL não parecer de teste.
//
// Para rodar: aponte DATABASE_URL para um banco de teste (Neon branch, local,
// ou banco dedicado) e rode `npm run test:e2e`. Se tiver ABSOLUTA certeza de
// que o alvo é descartável, defina E2E_ALLOW_PROD=1.
export default function globalSetup() {
  const url = process.env.DATABASE_URL ?? "";
  const looksLikeTest = /localhost|127\.0\.0\.1|_test\b|test_|-test|e2e|staging/i.test(url);
  const allowProd = process.env.E2E_ALLOW_PROD === "1";

  if (!url) {
    throw new Error(
      "[e2e] DATABASE_URL não definido. Aponte para um banco de teste antes de rodar os E2E.",
    );
  }
  if (!looksLikeTest && !allowProd) {
    throw new Error(
      "[e2e] ABORTADO: DATABASE_URL parece ser de PRODUÇÃO.\n" +
        "      Os testes criam/editam dados. Aponte DATABASE_URL para um banco de teste\n" +
        "      (Neon branch, local, staging) ou defina E2E_ALLOW_PROD=1 se o alvo for descartável.",
    );
  }
}

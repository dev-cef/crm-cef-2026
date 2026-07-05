# Testes E2E (Playwright)

Cobrem os fluxos críticos: proteção de rotas por papel, login, cadastro de
associado e lançamento de pagamento.

## ⚠️ Nunca rode contra produção

Os testes criam/editam dados. O `global-setup.ts` **aborta** se `DATABASE_URL`
parecer de produção. Use um banco de teste:

- um **branch do Neon** (isolado do prod), ou
- um Postgres local/staging.

## Como rodar

1. Aponte `DATABASE_URL` para o banco de teste (ex.: `.env.local` temporário ou
   `DATABASE_URL=... npm run test:e2e`).
2. Prepare o schema e o seed nesse banco:
   ```bash
   npm run db:push
   npm run seed
   ```
3. Rode:
   ```bash
   npm run test:e2e         # headless
   npm run test:e2e:ui      # modo interativo
   ```

O Playwright sobe um `next dev` na porta 3100 automaticamente. Para mirar uma URL
já no ar, defina `E2E_BASE_URL` (aí o servidor local não é iniciado).

## Estado dos testes

- **Rodam por padrão**: proteção de rotas, login (render + inválido + admin),
  presença dos controles de pagamento, render/validação da etapa 1 do cadastro.
- **`test.fixme`** (prontos, mas desligados até validar seletores no seu
  ambiente): cadastro completo (5 etapas) e lançamento efetivo da mensalidade.
  Remova o `.fixme` após confirmar os seletores contra o banco de teste.

# Auditoria Técnica — CRM CEF 2026

_Data: 2026-07-05 · Escopo: arquitetura, código, UX/UI, segurança, banco, APIs, performance, DevOps, acessibilidade._
_Base analisada: Next.js 16.2 (App Router) + Prisma 7 + Postgres (Neon) + NextAuth v5 beta._

---

## Sumário executivo (para a diretoria)

O CRM do CEF está **acima da média de projetos deste porte em segurança e organização de domínio**: RBAC real com permissões por módulo, lockout de login com backoff exponencial, 2FA (TOTP) com códigos de recuperação, auditoria (`AuditLog`), soft delete, CSP e headers de segurança configurados, e webhooks autenticados por token. Isso é raro em sistemas de clube e merece registro.

Os riscos concentram-se em **três frentes**:

1. **Autorização nas server actions** — a proteção de rotas vive no `proxy.ts` (middleware). Várias server actions de escrita (financeiro, eventos, patrimônio, biblioteca) chamam `auth()` só para carimbar o autor no log, mas **não verificam se o usuário _pode_ executar aquela ação**. Um DEPARTAMENTO sem permissão de financeiro, ou um associado, pode invocar a action diretamente. É o risco mais sério e o mais barato de corrigir.
2. **Valores monetários como `Float`** — `monthlyPrice`, `amount` de pagamentos e transações são `Float`. Isso causa erro de centavo em somatórios financeiros. O módulo de patrimônio já usa `Decimal(10,2)` corretamente — a inconsistência prova que a decisão certa já existe no projeto.
3. **Ausência de testes automatizados e de fluxo de migrations** — zero testes e uso de `db push` (sem histórico de migrations versionado) tornam refatorações e o crescimento da equipe arriscados.

Nenhum desses é bloqueante para operar hoje com dezenas/centenas de associados. **Todos se tornam graves ao escalar** para milhares de usuários ou ao abrir o cadastro público. Esforço estimado para eliminar os itens críticos e altos: **~2 a 3 semanas** de um dev, sem reescrita — o sistema não precisa de reforma, precisa de fechamento de lacunas.

**Score geral: 7.2 / 10.** Detalhamento na seção 14.

---

## 1. Arquitetura — Nota 7.5

**Pontos fortes**
- Separação clara: `app/` (rotas + server actions), `lib/` (domínio puro: `rbac`, `permissions`, `payments`, `messenger`, `audit`...), `components/modules/` por domínio.
- `lib/rbac.ts` é **isomórfico e sem dependência de servidor** — importável no edge/middleware. Decisão correta e deliberada.
- Módulos bem delimitados (associados, financeiro, eventos, patrimônio, biblioteca, carteirinha, mensageiro, documentos) espelhando o negócio — DDD implícito saudável.

**Problemas**
- **Autorização acoplada só à rota, não à ação.** `proxy.ts` protege navegação (`isRouteAllowed`), mas server actions são endpoints POST independentes. Faltam guardas dentro das actions (ver seção 5, risco Crítico).
- **Actions grandes e com múltiplas responsabilidades.** `financeiro/actions.ts` (792 linhas) mistura planos, pagamentos, transações, integração Asaas e geração de recibo. Dificulta teste e revisão.
- **Sem camada de serviço explícita** entre action e Prisma — regras de negócio ficam inline nas actions. Aceitável hoje; vira gargalo de manutenção conforme cresce.

**Plano de refatoração (incremental, sem big-bang)**
1. Criar `lib/guard.ts` com `assertCan(user, modulo, acao)` que **lança** (não redireciona) — usar no topo de toda action de escrita.
2. Extrair regras de negócio das actions para `lib/<dominio>/service.ts` (ex.: `lib/payments.ts` já existe — expandir o padrão).
3. Quebrar `financeiro/actions.ts` em `planos.actions.ts`, `pagamentos.actions.ts`, `transacoes.actions.ts`.

---

## 2. Código — Nota 7.0

**Fortes:** TypeScript `strict: true`, Zod em validações (`lib/validations/`), zero `dangerouslySetInnerHTML`, nomes descritivos em PT-BR consistentes, comentários explicam o _porquê_ (raro e valioso).

**Problemas**
| Item | Detalhe | Esforço |
|---|---|---|
| Componentes gigantes | `member-form.tsx` (862), `event-form.tsx` (815) — difíceis de testar | Médio |
| Actions monolíticas | `financeiro/actions.ts` (792) | Médio |
| Zero testes | Nenhum `.test`/`.spec` no projeto | Alto |
| Logging ad-hoc | 26 `console.*` em `lib/`+`app/` — sem logger estruturado | Baixo |
| Duplicação de guarda | Padrão `auth()` + checagem de role repetido manualmente em cada route handler | Baixo |

**Recomendação:** padronizar tratamento de erro das actions (hoje retornam `{ ok, error }` em alguns lugares e lançam em outros) e introduzir um logger fino (`lib/logger.ts`) com níveis, substituindo `console.*`.

---

## 3. UX — Nota 7.0

**Fortes:** cadastro multi-step de associado, toasts (sonner), fluxo de impersonação ("entrar como associado") com auditoria, área do associado (`meu-espaco`) separada.

**Riscos de abandono**
- **Estados de erro de página ausentes:** 0 `error.tsx` e 0 `not-found.tsx` em toda a árvore `app/`. Qualquer exceção não tratada mostra a tela de erro genérica do Next — o usuário não tem rota de recuperação. **Corrigir é rápido e tem alto impacto percebido.**
- **Skeletons parciais:** só 3 `loading.tsx` para ~15 seções. Listagens pesadas (associados, financeiro) sem skeleton passam sensação de travamento.
- **Formulários de 862 linhas** concentram muitos campos por etapa — validar tempo-para-concluir do cadastro em mobile.

---

## 4. UI Design — Nota 7.5

**Fortes:** shadcn/ui + Tailwind v4 + `next-themes` (dark mode), 85 usos de `aria-*`, design tokens em `app/globals.css`. Base consistente e moderna.

**A melhorar (pensando em Linear/Stripe):**
- Consolidar a escala tipográfica e de espaçamento em tokens documentados (o `design-system/crm-cef-2026/MASTER.md` recém-gerado pode servir de referência de auditoria — **não** adotar as fontes sugeridas por ele sobre o sistema atual).
- Padronizar status colors do financeiro (pago/pendente/atrasado = verde/âmbar/vermelho) como tokens semânticos reutilizáveis.
- Garantir que cor nunca seja o único indicador de status (adicionar ícone/label — requisito WCAG 1.4.1).

---

## 5. Segurança (OWASP Top 10) — Nota 7.5

### 🔴 CRÍTICO
**A01 — Broken Access Control em server actions.** As actions de escrita autenticam mas **não autorizam** por módulo/permissão. Ex.: `savePlan`, actions de `eventos`, `patrimonio`, `biblioteca` chamam `auth()` só para o `userId` do log. Um usuário DEPARTAMENTO autenticado (ou associado) pode disparar a action via POST sem passar pelo `proxy.ts`.
- **Impacto:** escrita/alteração não autorizada de dados financeiros, eventos, patrimônio.
- **Correção:** `assertCan(user, "financeiro", "create")` no topo de cada action. O sistema `can()`/`permissions.ts` **já existe** — só não está sendo aplicado de forma abrangente (documentos e mensageiro já usam; financeiro/eventos/patrimônio/biblioteca não).
- **Esforço:** Baixo. **Ganho:** Alto.

### 🟠 ALTO
- **Sem rate limiting nos endpoints públicos.** `/criar-conta`, `/esqueci-a-senha`, `/api/members/search`, `/api/webhooks/*` não têm throttle por IP. O lockout por conta protege senha, mas não impede enumeração/abuso. → Adicionar rate limit (Upstash/Vercel KV ou middleware) por IP.
- **`/api/members/search` sem autenticação aparente.** O route handler lê query e retorna nome, matrícula, foto, telefone e plano de associados **sem checar sessão**. Confirmar e fechar — vazamento de PII (telefone) viola LGPD.
- **`normalizeRole` faz fallback para ADMIN.** `return parsed.success ? parsed.data : "ADMIN"`. Um token/campo corrompido ou role desconhecida **vira admin** por padrão. Deve cair para o menor privilégio (`ASSOCIADO`). Fail-open em controle de acesso. → **Corrigir o default.**

### 🟡 MÉDIO
- **CSP com `'unsafe-inline'`** em `script-src` e `style-src`. Documentado como follow-up; endurecer com nonce reduz superfície de XSS.
- **Fotos como base64/data URI** salvas em `photoUrl` (String). Infla o banco, pesa em queries e no payload das listagens. → Migrar para storage de objetos (Vercel Blob) e guardar URL.
- **Segredos:** `.env*` corretamente ignorados no git ✓. Confirmar que `AUTH_GOOGLE_SECRET`, `CRON_SECRET`, tokens de webhook e `ASAAS_WEBHOOK_TOKEN` estão só em ambiente, nunca commitados.

### 🟢 BAIXO / OK
- Senhas com bcrypt ✓ · 2FA TOTP + recovery codes ✓ · lockout backoff ✓ · webhooks com token ✓ · cron com `CRON_SECRET` ✓ · headers HSTS/X-Frame/nosniff ✓ · sessão JWT com idle+absolute timeout por papel ✓.

---

## 6. Banco de Dados — Nota 6.5

- 🔴 **`Float` para dinheiro** (`monthlyPrice`, `Payment.amount`, `Transaction.amount`, `paymentAmount`, `valor`). Erro de arredondamento em somatórios. Patrimônio já usa `Decimal(10,2)` — **padronizar tudo em `Decimal`.** Esforço médio (migração + ajuste de leitura), ganho alto (correção financeira).
- 🟠 **Sem migrations versionadas** — fluxo `db push`. Perde-se histórico e reprodutibilidade. → Migrar para `prisma migrate` antes de crescer a equipe.
- 🟢 Índices bem colocados (`status`, `deletedAt`, `referenceYear/Month`, `entity/entityId`...) e `@@unique` de negócio corretos (ex.: `[memberId, referenceMonth, referenceYear]`).
- 🟡 Busca por nome usa `contains` sem `mode: "insensitive"` em alguns pontos (19 usos de insensitive existem, mas `members/search` não) — buscas acentuadas/caixa podem falhar. Para escala, considerar índice de texto (pg_trgm).

---

## 7. APIs — Nota 6.5
- Sem versionamento (`/api/v1`). Aceitável para app interno; planejar antes de expor a terceiros.
- Padronização de erro inconsistente entre route handlers e actions.
- Webhooks idempotentes e autenticados ✓ (bom exemplo: Asaas com no-op quando já pago).
- Faltam paginação/limite explícitos em `members/search` (retorna lista sem `take`).

---

## 8. Performance — Nota 7.0
- Paginação com `skip/take` na listagem de associados ✓.
- 🟠 **Base64 nas fotos** infla payload de listagens — maior ganho de performance disponível.
- Verificar N+1 em páginas com muitos `include` (dashboard, eventos/[id]).
- `bodySizeLimit: 6mb` em server actions por causa de upload base64 — resolvido junto com a migração para Blob.
- Aproveitar `next/image` (já configurado com remotePatterns) para todas as imagens remotas.

---

## 9. DevOps — Nota 6.0
- Deploy via Vercel com script de `snapshot` antes do prod ✓.
- 🟠 Sem CI (nenhum `.github/workflows`) — lint/build/test não rodam automaticamente em PR.
- Sem observabilidade estruturada (logs/métricas/alertas). → Vercel Analytics + logger estruturado + Sentry.
- Backup: existe módulo de backup e `snapshot.ts`; validar rotina de restauração (teste de recovery).

---

## 10. Qualidade — Nota 4.0
- **Zero testes** (unit/integração/E2E). Maior lacuna do projeto.
- ESLint configurado ✓, sem formatter dedicado (Prettier).
- **Prioridade:** E2E dos fluxos críticos (login+2FA, cadastro de associado, lançamento de pagamento, webhook Asaas) com Playwright (skill já instalada) + testes unitários de `rbac.ts`/`permissions.ts`.

---

## 11. Acessibilidade (WCAG 2.2) — Nota 6.5
- 85 `aria-*` — base existe. Auditar: foco visível em todos os interativos, ordem de tabulação, `prefers-reduced-motion` (usa `motion`), contraste 4.5:1 em light e dark **separadamente**, e cor-não-única em status financeiro.
- Formulários: garantir `label` associado, erro próximo ao campo e foco no primeiro inválido após submit.

---

## 12. Priorização

| Prioridade | Problema | Impacto | Complexidade | Solução |
|---|---|---|---|---|
| 🔴 P0 | Actions sem autorização | Crítico | Baixa | `assertCan()` em toda action de escrita |
| 🔴 P0 | `normalizeRole` → ADMIN por default | Crítico | Trivial | Default para `ASSOCIADO` |
| 🔴 P0 | `/api/members/search` PII sem auth | Crítico | Baixa | Exigir sessão + `take` |
| 🟠 P1 | Dinheiro em `Float` | Alto | Média | Migrar para `Decimal(10,2)` |
| 🟠 P1 | Sem rate limiting público | Alto | Média | Throttle por IP |
| 🟠 P1 | Zero testes | Alto | Alta | Playwright E2E + unit RBAC |
| 🟠 P1 | Fotos base64 no banco | Alto | Média | Vercel Blob + URL |
| 🟡 P2 | Sem `error.tsx`/`not-found.tsx` | Médio | Baixa | Adicionar por seção |
| 🟡 P2 | Sem migrations versionadas | Médio | Média | `prisma migrate` |
| 🟡 P2 | Sem CI | Médio | Baixa | GitHub Actions lint+build+test |
| 🟢 P3 | CSP `unsafe-inline` | Baixo | Média | Nonce |

---

## 13. Roadmap

**Imediato (24h)** — `normalizeRole` default seguro; guarda de auth em `/api/members/search`; `assertCan()` nas actions financeiras/eventos.
**Curto prazo (7 dias)** — cobrir todas as actions de escrita com `assertCan()`; `error.tsx`/`not-found.tsx`; rate limiting nos endpoints públicos e de login.
**Médio prazo (30 dias)** — migrar dinheiro para `Decimal`; fotos para Blob; adotar `prisma migrate`; CI com lint+build; E2E dos 4 fluxos críticos.
**Longo prazo (90 dias)** — extrair camada de serviço; quebrar actions/forms grandes; observabilidade (Sentry+métricas); endurecer CSP com nonce; testes unitários abrangentes de RBAC/permissões.

---

## 14. Scores

| Dimensão | Nota | Justificativa |
|---|---|---|
| Arquitetura | 7.5 | Domínio bem separado, RBAC isomórfico; autorização acoplada só à rota |
| Código | 7.0 | Strict TS + Zod; componentes/actions grandes, sem testes |
| UX | 7.0 | Fluxos ricos; faltam estados de erro/vazio e skeletons |
| UI | 7.5 | shadcn+dark mode sólidos; tokens a consolidar |
| Segurança | 7.5 | 2FA/lockout/audit fortes; autorização de action e fail-open pendentes |
| Performance | 7.0 | Paginação ok; base64 nas fotos pesa |
| Escalabilidade | 6.5 | Neon/serverless ok; Float, sem cache/rate-limit, fotos no banco |
| Banco de Dados | 6.5 | Índices bons; Float p/ dinheiro e sem migrations |
| APIs | 6.5 | Webhooks sólidos; sem versionamento/paginação padrão |
| DevOps | 6.0 | Deploy ok; sem CI nem observabilidade |
| Manutenibilidade | 6.5 | Nomes/comentários bons; arquivos grandes, sem testes |
| Acessibilidade | 6.5 | Base aria existe; falta auditoria formal WCAG 2.2 |
| Experiência Mobile | 7.0 | Mobile-first shadcn; validar forms longos no celular |
| **Qualidade Geral** | **7.2** | Base madura e segura; fechar autorização, dinheiro e testes |

---

## 15. Impacto esperado pós-implementação
Fechados P0+P1: **Segurança 7.5→9.0**, **Banco 6.5→8.0**, **Qualidade Geral 7.2→8.5**, e o sistema fica apto a abrir cadastro público e escalar para milhares de associados com confiança financeira e de acesso.

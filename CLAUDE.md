
# CRM CEF 2026 — Prompt de Desenvolvimento

## Visão Geral

Construa um sistema CRM completo para o **Clube Excursionista de Friburgo (CEF)**, voltado ao
gerenciamento de associados, carteirinhas, aniversariantes, financeiro, planos e eventos.
O sistema deve ser moderno, responsivo e protegido por autenticação.

---

## Stack Técnica

- **Framework:** Next.js 15 com TypeScript (App Router)
- **Banco de dados:** SQLite (arquivo local via Prisma ORM — zero config)
- **Autenticação:** NextAuth.js — Login com Google OAuth + email/senha
- **UI:** Tailwind CSS + shadcn/ui (componentes acessíveis e prontos)
- **Moeda:** BRL (R$) com formatação pt-BR
- **Datas:** Formato brasileiro (DD/MM/AAAA)
- **Ícones:** Lucide React
- **Formulários:** React Hook Form + Zod (validação)

---

## Módulos do Sistema

### 🏠 Dashboard
Página inicial após login com cards de resumo:
- Total de associados ativos
- Aniversariantes do mês
- Receita mensal (planos pagos vs pendentes)
- Próximos eventos
- Atalhos rápidos para cadastro de associado e novo evento

---

### 1. Módulo — Associados

#### 1.1 Listagem
- Tabela com busca, filtro por status (Ativo/Inativo) e paginação
- Colunas: Foto, Nome, CPF, Plano, Status, Ações (Ver, Editar, Excluir)
- Exportar lista em CSV/PDF

#### 1.2 Cadastro — Multi-Step Form (5 etapas com barra de progresso)

**Seção 01 — Informações Pessoais**
- Nome completo *(obrigatório)*
- Sexo: Masculino / Feminino
- E-mail *(validação de formato, obrigatório)*
- Telefone *(máscara: (99) 99999-9999, obrigatório)*
- Data de nascimento *(máscara: DD/MM/AAAA, calcular idade automaticamente)*
- CPF *(máscara: 999.999.999-99, validação de dígitos verificadores)*
- Foto *(upload com preview, aceitar JPG/PNG, max 2MB)*

**Seção 02 — Endereço**
- CEP *(ao digitar, preencher campos automaticamente via API ViaCEP)*
- Logradouro
- Número
- Complemento *(opcional)*
- Bairro
- Cidade
- Estado *(UF, seletor)*

**Seção 03 — Saúde e Emergência**
- Tipo sanguíneo: `[A+, A-, B+, B-, AB+, AB-, O+, O-, Não sei]`
- Nome do contato de emergência
- Telefone do contato de emergência *(máscara)*
- Condições de saúde *(multi-seleção com checkboxes):*
  - Alérgico | Hipertensão | Diabetes | Vertigens | Problema cardíaco
  - Problema pulmonar | Doença reumática | Doença hematológica | Hérnia | Outros
- Campo texto: *"Qual doença/alergia?"* *(exibir se alguma opção for selecionada)*

**Seção 04 — Experiência em Atividades de Montanha**
- Tempo de experiência *(radio button):*
  - Nunca pratiquei
  - Menos de 1 ano
  - Mais de 1 ano
  - Mais de 5 anos
  - Mais de 10 anos
  - Já pratiquei, mas estou parado há alguns anos
- Participa ou participou de outro grupo/clube excursionista? *(Sim/Não)*
- Se Sim: *"Qual o nome do grupo?"*

**Seção 05 — Interesses em Atividades**
Escala de interesse de 1 a 5 (componente de rating/slider) para:
- Caminhada
- Escalada
- Curso de Montanhismo / Escalada
- Bike
- Campanhas Ecológicas
- Campo aberto: *Sugestões*

#### 1.3 Visualização do Associado
- Página de perfil completo com todas as informações
- Histórico de pagamentos
- Badge de plano atual
- Botões de editar e desativar

---

### 2. Módulo — Carteirinha

Geração de carteirinha digital do associado com:
- Foto do associado
- Nome completo
- CPF (parcialmente mascarado: 999.***.***-99)
- Número de matrícula
- Plano / Categoria
- Data de validade
- Logo do CEF
- QR Code (com link para validação do associado)
- Opção de download em PDF e compartilhar via link

---

### 3. Módulo — Aniversariantes

- Listagem de aniversariantes por mês/semana/dia
- Colunas: Foto, Nome completo, Faixa etária, Data de aniversário, Telefone
- Filtro por mês

#### 3.1 Mensagem Automática de Aniversário
- Configurar texto personalizado de parabéns
- Envio automático no dia do aniversário via:
  - WhatsApp (link de API ou Twilio)
  - E-mail (template HTML com Nodemailer)
- Log de mensagens enviadas (data, nome, canal)

---

### 4. Módulo — Financeiro

#### 4.1 Planos
CRUD completo de planos:
- Nome do plano (Ex: Sócio Efetivo, Sócio Familiar, Sócio Estudante)
- Valor mensal em BRL
- Descrição / benefícios
- Status (Ativo/Inativo)

#### 4.2 Pagamentos
- Lançar mensalidade por associado
- Status: Pago / Pendente / Atrasado
- Filtro por mês/ano, plano e status
- Dashboard com resumo: total arrecadado, inadimplentes, a receber
- Exportar relatório financeiro em CSV

---

### 5. Módulo — Eventos

CRUD de eventos:
- Nome do evento
- Descrição
- Data e hora
- Local / Trilha
- Dificuldade: Fácil / Moderado / Difícil / Técnico
- Vagas disponíveis
- Inscrições (associados inscritos)
- Status: Planejado / Confirmado / Realizado / Cancelado
- Galeria de fotos (upload múltiplo)

---

## Regras Gerais

- ✅ Todo o sistema protegido por login (redirect automático se não autenticado)
- ✅ Validação de inputs no frontend (Zod) e nas APIs (server actions / route handlers)
- ✅ UI responsiva, abordagem mobile-first
- ✅ Notificações de sucesso/erro com toast (sonner ou shadcn/ui toast)
- ✅ Skeleton loaders em todas as listagens e páginas de detalhe
- ✅ Confirmação de exclusão com modal (nunca exclusão direta)
- ✅ Soft delete para associados (campo `deletedAt`, não apagar do banco)
- ✅ Logs de auditoria: registrar quem criou/editou registros e quando

---

## Seed de Dados

Criar script `npm run seed` que popula o banco com:
- 3 usuários administradores fictícios
- 30 associados com dados realistas (nomes, CPFs válidos, endereços de Nova Friburgo/RJ)
- 3 planos (Sócio Efetivo R$50/mês, Familiar R$80/mês, Estudante R$25/mês)
- Pagamentos dos últimos 6 meses
- 5 eventos (2 passados, 1 em andamento, 2 futuros)

---

## Comandos

```bash
npm run dev      # Servidor de desenvolvimento
npm run build    # Build de produção
npm run seed     # Popular banco com dados de teste
npm run db:push  # Aplicar schema do Prisma ao banco SQLite
```

---

## Estrutura de Pastas Sugerida

```
/app
  /dashboard
  /associados
  /carteirinha
  /aniversariantes
  /financeiro
  /eventos
  /api
/components
  /ui          # shadcn/ui
  /forms       # multi-step form, inputs com máscara
  /modules     # componentes por módulo
/lib
  /prisma.ts
  /auth.ts
  /validations # schemas Zod
/prisma
  schema.prisma
  seed.ts
```

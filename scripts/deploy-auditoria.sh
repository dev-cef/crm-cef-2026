#!/usr/bin/env bash
#
# Deploy coordenado da auditoria (P0 + P1). Faz, em sequência e com janela
# mínima, a migração de schema e o deploy do código novo.
#
# ⚠️ ATENÇÃO: dev e produção compartilham o MESMO banco Neon. O `prisma db push`
#    altera o banco que serve os usuários ao vivo. Entre o `db push` e o deploy
#    há uma janela em que o código VELHO ainda no ar lê o schema NOVO — por isso
#    os dois passos são feitos aqui um logo após o outro. Rode em baixo tráfego.
#
# Uso:  bash scripts/deploy-auditoria.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploy coordenado — Auditoria P0/P1 (Decimal + RateLimit + fotos)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Resolve e mostra o banco-alvo (mascarado) a partir do .env.local.
DATABASE_URL="$(node -e 'require("dotenv").config({path:".env.local"});process.stdout.write(process.env.DATABASE_URL||"")')"
if [ -z "$DATABASE_URL" ]; then
  echo "✗ DATABASE_URL não encontrado no .env.local. Abortando."
  exit 1
fi
export DATABASE_URL
DB_HOST="$(echo "$DATABASE_URL" | sed -E 's#.*@([^/?]+).*#\1#')"
echo "  Banco-alvo (COMPARTILHADO dev+prod): $DB_HOST"
echo "  Branch git: $(git rev-parse --abbrev-ref HEAD)"
echo ""
echo "  Este script vai, NESTA ordem:"
echo "    1) snapshot (backup do banco)"
echo "    2) prisma db push  → altera colunas p/ Decimal + cria tabela RateLimit"
echo "    3) deploy:painel   → publica o código novo em painel.cef.org.br"
echo ""
read -r -p "  Digite CONFIRMO para prosseguir: " ans
[ "$ans" = "CONFIRMO" ] || { echo "Cancelado."; exit 1; }

# 2. Backup antes de qualquer alteração (rollback via Snapshot em caso de erro).
echo ""
echo "▶ [1/3] Snapshot de backup..."
npm run snapshot -- "pre-deploy-auditoria-$(date +%Y%m%d-%H%M)"

# 3. Migração de schema (janela crítica começa aqui).
echo ""
echo "▶ [2/3] prisma db push (aplicando Decimal + RateLimit)..."
npx prisma db push

# 4. Deploy imediato do código novo — fecha a janela.
echo ""
echo "▶ [3/3] Deploy para painel.cef.org.br..."
npm run deploy:painel

echo ""
echo "✓ Migração de schema + deploy concluídos."
echo ""
echo "  Passos restantes (SEM janela crítica — fotos têm fallback):"
echo "    4) Provisionar Vercel Blob e setar BLOB_READ_WRITE_TOKEN no projeto."
echo "    5) npm run migrate:photos   (converte as fotos base64 antigas)"
echo ""
echo "  Rollback do banco, se necessário: restaurar o snapshot"
echo "  'pre-deploy-auditoria-*' pela tela Configurações › Backup."

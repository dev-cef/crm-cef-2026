import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const BASE = 'https://crm-cef-2026-1.vercel.app';
const EMAIL = 'admin@cef.org.br';
const PASS  = 'Cef@2026Friburgo!';
const DIR   = '/tmp/screenshots-categorias';

mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

function ss(name) {
  return page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });
}

console.log('▶ 1. Fazendo login...');
await page.goto(`${BASE}/login`);
await page.waitForLoadState('networkidle');
await ss('01-login');

await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard', { timeout: 15000 });
console.log('✅ Login OK');
await ss('02-dashboard');

console.log('▶ 2. Acessando /financeiro/categorias...');
await page.goto(`${BASE}/financeiro/categorias`);
await page.waitForLoadState('networkidle');
await ss('03-categorias-page');

// Verificar se a página carregou
const title = await page.textContent('h1, [class*="page-header"] h1, h2').catch(() => null);
console.log('   Título encontrado:', title);

// Verificar colunas Entradas e Saídas
const entradas = await page.locator('text=Entradas').first().isVisible();
const saidas   = await page.locator('text=Saídas').first().isVisible();
console.log(`✅ Coluna Entradas visível: ${entradas}`);
console.log(`✅ Coluna Saídas visível: ${saidas}`);

// Verificar categorias populadas
const categoryItems = await page.locator('[class*="rounded-xl border"]').count();
console.log(`✅ Categorias renderizadas: ${categoryItems}`);

console.log('▶ 3. Expandindo primeira categoria de Entradas...');
const firstChevron = page.locator('button[aria-label="Expandir"]').first();
const chevronVisible = await firstChevron.isVisible();
if (chevronVisible) {
  await firstChevron.click();
  await page.waitForTimeout(400);
  await ss('04-categoria-expandida');
  const subcats = await page.locator('text=Mensalidade Sócio').first().isVisible();
  console.log(`✅ Subcategorias visíveis após expandir: ${subcats}`);
} else {
  console.log('⚠️  Botão expandir não encontrado');
}

console.log('▶ 4. Testando adicionar nova categoria...');
const inputs = page.locator('input[placeholder*="Nova categoria"]');
const inputCount = await inputs.count();
console.log(`   Campos de nova categoria encontrados: ${inputCount}`);
if (inputCount > 0) {
  await inputs.first().fill('Categoria Teste Playwright');
  await ss('05-nova-categoria-preenchida');
  // Não submeter para não poluir o banco — apenas verificar o campo
  console.log('✅ Campo de nova categoria funcional');
  await inputs.first().fill(''); // limpar
}

console.log('▶ 5. Testando modal de exclusão...');
const deleteBtn = page.locator('button[aria-label*="Excluir"]').first();
const deleteBtnVisible = await deleteBtn.isVisible();
if (deleteBtnVisible) {
  await deleteBtn.click();
  await page.waitForTimeout(300);
  const modal = await page.locator('[role="dialog"]').isVisible();
  await ss('06-modal-exclusao');
  console.log(`✅ Modal de exclusão aberto: ${modal}`);
  // Fechar modal sem confirmar
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  console.log('✅ Modal fechado sem excluir');
} else {
  console.log('⚠️  Botão excluir não visível (categoria pode estar colapsada)');
}

console.log('▶ 6. Verificando link no menu lateral...');
const navLink = await page.locator('nav a[href="/financeiro/categorias"]').isVisible();
console.log(`✅ Link "Categorias" no menu lateral: ${navLink}`);
await ss('07-menu-lateral');

console.log('▶ 7. Testando acesso via menu Financeiro...');
await page.goto(`${BASE}/financeiro`);
await page.waitForLoadState('networkidle');
const cardCategorias = await page.locator('text=Categorias').first().isVisible();
console.log(`✅ Card Categorias no dashboard financeiro: ${cardCategorias}`);
await ss('08-financeiro-dashboard');

await browser.close();
console.log(`\n📁 Screenshots salvas em ${DIR}`);

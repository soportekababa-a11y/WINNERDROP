const { chromium } = require('playwright');

const EMAIL = 'soportekababa@gmail.com';
const PASSWORD = 'Davdem.Online';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('https://effi.com.co/ingreso', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[placeholder*="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Ingresar")').click();
  await page.waitForURL(url => !url.href.includes('/ingreso'), { timeout: 15000 });

  // Probar diferentes formatos de paginación
  const urls = [
    'https://effi.com.co/app/articulo_dropshipping?pagina=2',
    'https://effi.com.co/app/articulo_dropshipping?page=2',
    'https://effi.com.co/app/articulo_dropshipping?p=2',
  ];

  for (const url of urls) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const cards = await page.locator('.product-card').count();
    const currentUrl = page.url();
    const firstName = await page.evaluate(() => document.querySelector('.ver-detalles')?.getAttribute('data-descripcion') ?? 'N/A');
    console.log(`URL: ${url}`);
    console.log(`  → Redirigido a: ${currentUrl}`);
    console.log(`  → Cards: ${cards} | Primer producto: ${firstName}`);
    console.log('');
  }

  // Ver HTML del paginador
  await page.goto('https://effi.com.co/app/articulo_dropshipping', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const paginatorHTML = await page.locator('.pagination, [class*="paginat"], nav[aria-label*="page"]').first().innerHTML().catch(() => 'no encontrado');
  console.log('HTML Paginador:', paginatorHTML.substring(0, 800));

  // Total de productos reportados
  const totalText = await page.locator('text=/\\d+ Artículos/').textContent().catch(() => '');
  console.log('Total reportado:', totalText);

  await browser.close();
})();

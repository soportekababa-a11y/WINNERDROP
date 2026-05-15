const { chromium } = require('playwright');

const EMAIL = 'soportekababa@gmail.com';
const PASSWORD = 'Davdem.Online';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  console.log('Logueando...');
  await page.goto('https://effi.com.co/ingreso', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[placeholder*="Email"], input[placeholder*="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Ingresar")').click();
  await page.waitForURL(url => !url.href.includes('/ingreso'), { timeout: 15000 });
  console.log('Login OK');

  // Click en el link principal de Dropshipping (el del menú lateral)
  await page.getByRole('link', { name: ' Dropshipping ' }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot-dropshipping-menu.png', fullPage: true });
  console.log('Screenshot 1: screenshot-dropshipping-menu.png');

  // Listar todos los links visibles ahora
  const links = await page.locator('a[href]').all();
  for (const link of links) {
    const text = await link.textContent();
    const href = await link.getAttribute('href');
    if (text && text.trim().length > 2) {
      console.log(`  [${text.trim()}] -> ${href}`);
    }
  }

  // Intentar navegar al catálogo de productos
  console.log('\nBuscando catalogo de productos...');
  const catalogLink = page.locator('a[href*="catalogo"], a[href*="producto"], a[href*="inventario_drop"]').first();
  if (await catalogLink.count() > 0) {
    await catalogLink.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshot-catalogo.png', fullPage: true });
    console.log('Screenshot 2: screenshot-catalogo.png - URL:', page.url());
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();

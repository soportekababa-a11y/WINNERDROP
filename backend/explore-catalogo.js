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

  // --- CATÁLOGO DE ARTÍCULOS DROPSHIPPING ---
  console.log('\n=== CATALOGO ARTICULOS DROPSHIPPING ===');
  await page.goto('https://effi.com.co/app/articulo_dropshipping', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshot-articulos-drop.png', fullPage: true });
  console.log('Screenshot: screenshot-articulos-drop.png');
  console.log('URL:', page.url());

  // Extraer texto de la tabla/lista
  const articulosText = await page.locator('table, .table, .list, .grid, .card').first().textContent().catch(() => 'No tabla encontrada');
  console.log('Contenido (primeros 500 chars):', articulosText?.substring(0, 500));

  // Ver encabezados de columnas si hay tabla
  const headers = await page.locator('th, .col-header, .header').allTextContents();
  console.log('Encabezados:', headers.filter(h => h.trim().length > 0));

  await page.waitForTimeout(2000);

  // --- ÓRDENES DE VENTA ---
  console.log('\n=== ORDENES DE VENTA ===');
  await page.goto('https://effi.com.co/app/orden_v', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshot-ordenes-venta.png', fullPage: true });
  console.log('Screenshot: screenshot-ordenes-venta.png');

  const ordenesHeaders = await page.locator('th, .col-header').allTextContents();
  console.log('Encabezados órdenes:', ordenesHeaders.filter(h => h.trim().length > 0));

  // --- CATÁLOGO DE PROVEEDORES ---
  console.log('\n=== CATALOGO PROVEEDORES ===');
  await page.goto('https://effi.com.co/app/proveedor_dropshipping', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshot-proveedores-drop.png', fullPage: true });
  console.log('Screenshot: screenshot-proveedores-drop.png');

  await page.waitForTimeout(2000);
  await browser.close();
  console.log('\nExploracion completada');
})();

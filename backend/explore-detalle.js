const { chromium } = require('playwright');

const EMAIL = 'soportekababa@gmail.com';
const PASSWORD = 'Davdem.Online';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  console.log('Logueando...');
  await page.goto('https://effi.com.co/ingreso', { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[placeholder*="email"], input[placeholder*="Email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Ingresar")').click();
  await page.waitForURL(url => !url.href.includes('/ingreso'), { timeout: 15000 });
  console.log('Login OK');

  // --- ZOOM en catálogo de artículos ---
  console.log('\n=== ZOOM CATALOGO ARTICULOS ===');
  await page.goto('https://effi.com.co/app/articulo_dropshipping', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Screenshot del primer producto con zoom
  await page.screenshot({ path: 'screenshot-catalogo-zoom.png', clip: { x: 210, y: 100, width: 1180, height: 500 } });
  console.log('Screenshot zoom: screenshot-catalogo-zoom.png');

  // Extraer HTML de una tarjeta de producto para ver qué datos tiene
  const primerCard = await page.locator('.card, .product-card, .articulo, [class*="product"], [class*="card"]').first();
  const cardHTML = await primerCard.innerHTML().catch(() => null);
  if (cardHTML) console.log('HTML primer card (500 chars):', cardHTML.substring(0, 500));

  // Buscar si hay texto de "vendidos", "ventas", "unidades"
  const pageContent = await page.content();
  const hasVentas = pageContent.includes('vendido') || pageContent.includes('ventas') || pageContent.includes('unidades vendidas');
  console.log('¿Tiene datos de ventas en catálogo?', hasVentas);

  // Todos los textos de las cards
  const cards = await page.locator('.row .col, .product-item, [class*="card"]').all();
  console.log('Número de cards encontradas:', cards.length);
  if (cards.length > 0) {
    const firstCardText = await cards[0].textContent();
    console.log('Texto primera card:', firstCardText?.trim().substring(0, 300));
  }

  // --- REPORTES Y ANÁLISIS EN ÓRDENES DE VENTA ---
  console.log('\n=== REPORTES ORDENES DE VENTA ===');
  await page.goto('https://effi.com.co/app/orden_v', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click en "Reportes y análisis de datos"
  await page.locator('text=Reportes y análisis').click().catch(() => console.log('No encontró tab reportes'));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot-reportes-ventas.png', fullPage: true });
  console.log('Screenshot reportes: screenshot-reportes-ventas.png');

  // --- CLICK EN UN PRODUCTO DEL CATÁLOGO para ver su detalle ---
  console.log('\n=== DETALLE DE PRODUCTO ===');
  await page.goto('https://effi.com.co/app/articulo_dropshipping', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click en el primer producto
  const firstProduct = page.locator('a[href*="articulo_dropshipping"], .btn-ver, button:has-text("Ver"), a:has-text("Ver detalle")').first();
  if (await firstProduct.count() > 0) {
    await firstProduct.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshot-producto-detalle.png', fullPage: true });
    console.log('Screenshot detalle: screenshot-producto-detalle.png - URL:', page.url());
  } else {
    console.log('No encontró link de detalle de producto');
    // Intentar click directo en la primera imagen/card
    await page.locator('.card, [class*="product"]').first().click().catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshot-producto-detalle.png', fullPage: true });
    console.log('URL tras click:', page.url());
  }

  await page.waitForTimeout(2000);
  await browser.close();
  console.log('\nExploracion completada');
})();

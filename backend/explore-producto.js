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

  await page.goto('https://effi.com.co/app/articulo_dropshipping', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Extraer HTML completo de la primera product-card
  const cards = await page.locator('.product-card').all();
  console.log('Cards encontradas:', cards.length);

  if (cards.length > 0) {
    const htmlCard1 = await cards[0].innerHTML();
    console.log('\n=== HTML COMPLETO CARD 1 ===\n', htmlCard1);

    const htmlCard2 = await cards[1].innerHTML();
    console.log('\n=== HTML COMPLETO CARD 2 ===\n', htmlCard2);
  }

  // Click en "Ver más detalles" del primer producto
  console.log('\n=== ABRIENDO DETALLE PRODUCTO ===');
  const verMasBtn = page.locator('button:has-text("Ver más detalles"), a:has-text("Ver más detalles"), .btn:has-text("Ver")').first();
  if (await verMasBtn.count() > 0) {
    await verMasBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshot-detalle-producto.png', fullPage: true });
    console.log('Screenshot detalle: screenshot-detalle-producto.png - URL:', page.url());

    // HTML del modal o página de detalle
    const modal = await page.locator('.modal, .modal-dialog, [role="dialog"]').first();
    if (await modal.count() > 0) {
      const modalHTML = await modal.innerHTML();
      console.log('\n=== HTML MODAL DETALLE ===\n', modalHTML.substring(0, 2000));
    }
  }

  await page.waitForTimeout(2000);
  await browser.close();
})();

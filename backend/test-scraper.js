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
  console.log('Login OK');

  await page.goto('https://effi.com.co/app/articulo_dropshipping', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const products = await page.evaluate(() => {
    const cards = document.querySelectorAll('.product-card');
    const results = [];

    cards.forEach(card => {
      try {
        // Nombre: data-descripcion (funciona para todos los productos)
        const verDetalles = card.querySelector('.ver-detalles');
        const name = verDetalles?.getAttribute('data-descripcion')?.trim() ?? '';
        const effiId = verDetalles?.getAttribute('data-codigo') ?? '';
        const imageUrl = verDetalles?.getAttribute('data-url_foto') ?? card.querySelector('.img-box img')?.getAttribute('src') ?? '';

        if (!name) return;

        // Stats
        const labels = Array.from(card.querySelectorAll('.product-stats .label'));
        let stock = 0, salesCount = 0, vinculado = 0;
        labels.forEach(label => {
          const text = label.textContent ?? '';
          const stockM   = text.match(/Stock:\s*([\d,]+)/);
          const salesM   = text.match(/Ventas:\s*([\d,]+)/);
          const vincM    = text.match(/Vinculado:\s*([\d,]+)/);
          if (stockM) stock      = parseInt(stockM[1].replace(/,/g, ''));
          if (salesM) salesCount = parseInt(salesM[1].replace(/,/g, ''));
          if (vincM)  vinculado  = parseInt(vincM[1].replace(/,/g, ''));
        });

        // Precio
        const priceText = card.querySelector('.price-block')?.textContent ?? '';
        const costoM    = priceText.match(/Costo[:\s]+(?:RD\$)?\s*([\d,.]+)/i);
        const sugeridoM = priceText.match(/Sugerido[:\s]+(?:RD\$)?\s*([\d,.]+)/i);
        const cost  = costoM    ? parseFloat(costoM[1].replace(/,/g, ''))    : 0;
        const price = sugeridoM ? parseFloat(sugeridoM[1].replace(/,/g, '')) : 0;

        // Categoría
        const catLinks = Array.from(card.querySelectorAll('.product-meta a'));
        const category    = catLinks[0]?.textContent?.trim() ?? '';
        const subcategory = catLinks[1]?.textContent?.trim() ?? '';

        results.push({ effiId, name, imageUrl, stock, salesCount, vinculado, cost, price, category: subcategory || category });
      } catch(e) {}
    });

    return results;
  });

  console.log(`Productos extraídos: ${products.length}`);

  products.sort((a, b) => b.salesCount - a.salesCount);
  console.log('\n=== TOP 15 POR VENTAS ===');
  products.slice(0, 15).forEach((p, i) => {
    console.log(`${i+1}. Ventas:${p.salesCount} | Stock:${p.stock} | RD$${p.price} | ${p.name}`);
  });

  await browser.close();
  console.log('\nTest completado!');
})();

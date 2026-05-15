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

  await page.goto('https://effi.com.co/app/articulo_dropshipping', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const debug = await page.evaluate(() => {
    const cards = document.querySelectorAll('.product-card');
    const results = [];

    cards.forEach((card, i) => {
      // Intentar diferentes selectores para el título
      const titleA    = card.querySelector('h4.product-title a');
      const titleH4   = card.querySelector('h4.product-title');
      const titleAny  = card.querySelector('[class*="title"]');
      const labels    = Array.from(card.querySelectorAll('.product-stats .label')).map(l => l.textContent?.trim());
      const dataDesc  = card.querySelector('.ver-detalles')?.getAttribute('data-descripcion');

      results.push({
        index: i,
        hasTitleA:   !!titleA,
        titleAText:  titleA?.textContent?.trim().substring(0, 40),
        titleH4Text: titleH4?.textContent?.trim().substring(0, 40),
        dataDesc:    dataDesc?.substring(0, 40),
        labels,
      });
    });

    return results;
  });

  console.log(`Total cards: ${debug.length}`);
  debug.forEach(d => {
    console.log(`[${d.index}] hasTitleA:${d.hasTitleA} | titleA:"${d.titleAText}" | desc:"${d.dataDesc}" | labels:${JSON.stringify(d.labels)}`);
  });

  await browser.close();
})();

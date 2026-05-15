const { chromium } = require('playwright');

// PON TUS CREDENCIALES AQUI
const EMAIL = 'soportekababa@gmail.com';
const PASSWORD = 'Davdem.Online';

(async () => {
  console.log('Abriendo navegador...');
  const browser = await chromium.launch({ headless: false }); // headless: false = ves el navegador
  const page = await browser.newPage();

  console.log('Yendo a Effi...');
  await page.goto('https://effi.com.co/ingreso', { waitUntil: 'networkidle' });

  console.log('Llenando formulario...');
  await page.locator('input[type="email"], input[placeholder*="Email"], input[placeholder*="email"], input[placeholder*="correo"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Ingresar")').click();

  console.log('Esperando login...');
  await page.waitForTimeout(5000);

  const url = page.url();
  console.log('URL despues del login:', url);

  await page.screenshot({ path: 'screenshot-login.png', fullPage: true });
  console.log('Screenshot guardado: screenshot-login.png');

  await page.waitForTimeout(3000);
  await browser.close();
  console.log('Listo!');
})();

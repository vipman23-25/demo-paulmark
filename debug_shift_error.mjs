import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE UNCAUGHT ERROR:', error.message);
    console.log(error.stack);
  });

  await page.goto('http://localhost:8080/login');
  
  // Try login
  try {
    await page.fill('input[type="text"]', '10124241746');
    await page.fill('input[type="password"]', '123456');
    await page.click('button:has-text("Giriş Yap")');
    await page.waitForNavigation({ waitUntil: 'networkidle' });
  } catch(e) {
    console.log("Login failed or skipped", e.message);
  }

  // Go to Vardiya Motoru tab if not already there
  // Since it's a SPA, we might need to click the navigation
  try {
    // Navigasyon menüsünde Vardiya Yönetimi'ni bul ve tıkla
    await page.click('text="Vardiya Yönetimi"');
    await page.click('text="Vardiya Motoru"');
  } catch(e) {
    console.log("Could not click menu, navigating directly...");
    await page.goto('http://localhost:8080/admin/shift-management');
    await page.waitForTimeout(2000);
    await page.click('text="Vardiya Motoru"');
  }

  await page.waitForTimeout(1000);

  // Set the date
  try {
    // Fill the date input
    await page.fill('input[type="date"]', '2024-05-20');
    await page.click('button:has-text("Otomatik Hazırla")');
    console.log("Clicked Otomatik Hazırla");
    
    // Wait for a bit to let the error happen
    await page.waitForTimeout(3000);
    
  } catch(e) {
    console.log("Failed to click generate", e.message);
  }

  await browser.close();
})();

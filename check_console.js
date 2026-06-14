import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.goto('http://localhost:8080/');
  await page.waitForTimeout(5000);
  
  const content = await page.content();
  console.log("HTML CONTENT:", content);
  
  await browser.close();
})();

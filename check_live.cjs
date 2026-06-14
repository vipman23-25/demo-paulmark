const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));

  console.log("Navigating to https://paulmark1.vercel.app...");
  await page.goto('https://paulmark1.vercel.app');
  
  await page.waitForTimeout(5000); // wait to let react load and maybe crash
  console.log("Done checking.");
  await browser.close();
})();

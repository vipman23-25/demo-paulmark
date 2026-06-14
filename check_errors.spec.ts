import { test, expect } from '@playwright/test';

test('check page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('http://localhost:8080/login', { waitUntil: 'networkidle' });
  
  // Wait a moment for any react lifecycle errors
  await page.waitForTimeout(2000);
  
  if (errors.length > 0) {
    console.log('--- FOUND ERRORS ---');
    errors.forEach(e => console.log(e));
  } else {
    console.log('--- NO ERRORS FOUND ---');
    console.log(await page.content());
  }
});

import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', error => console.error('BROWSER_ERROR:', error));
  
  await page.goto('https://axis-platform-238975492579.us-central1.run.app', { waitUntil: 'networkidle' });
  
  await browser.close();
})();

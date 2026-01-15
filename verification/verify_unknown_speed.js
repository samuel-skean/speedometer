
import { test, expect, chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  // Portrait view
  const page = await browser.newPage({ viewport: { width: 375, height: 667 } });

  await page.addInitScript(() => {
     window.__TEST_MODE__ = true;
  });

  await page.goto('http://localhost:5173');

  // Verify Unknown Speed Message
  await page.evaluate(() => {
     // Hide warning (simulate fresh data or whatever, but here we want to test position)
     const warning = document.getElementById('warning');
     if (warning) warning.hidden = true;

     // Show unknown speed
     const unknown = document.getElementById('unknown-speed-msg');
     if (unknown) unknown.hidden = false;
  });

  await page.waitForTimeout(100);
  await page.screenshot({ path: 'verification/unknown_speed_final.png' });

  await browser.close();
})();

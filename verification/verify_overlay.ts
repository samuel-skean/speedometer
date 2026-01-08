import { chromium, devices } from "@playwright/test";

(async () => {
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext(devices["iPhone 12"]);
  const page = await context.newPage();

  // Mock Geolocation and UserAgent to ensure app loads
  await page.addInitScript(() => {
    // @ts-expect-error
    if (typeof GeolocationCoordinates === "undefined") {
      // @ts-expect-error
      window.GeolocationCoordinates = class {};
    }
    Object.defineProperty(GeolocationCoordinates.prototype, "speed", {
      get: () => 0,
      configurable: true,
      enumerable: true,
    });
    Object.defineProperty(navigator, "userAgentData", {
      get: () => ({ mobile: true }),
      configurable: true,
    });
    localStorage.clear();
    // Suppress auto-open to ensure clean state
    localStorage.setItem("info-popover-shown", "true");
  });

  await page.goto("http://localhost:5173");

  // Open info popover
  await page.getByLabel("Show info").click();

  // Inject content to force scroll
  await page.evaluate(() => {
    const content = document.querySelector(".info-content");
    if (content) {
      for (let i = 0; i < 20; i++) {
        const p = document.createElement("p");
        p.textContent = `Extra content line ${i} to force scrolling and show the overlay.`;
        content.appendChild(p);
      }
    }
    window.dispatchEvent(new Event("resize"));
  });

  // Wait for overlay to appear
  const overlay = page.locator(".scroll-overlay");
  await overlay.waitFor({ state: "visible" });

  // Take screenshot
  await page.screenshot({ path: "verification/overlay.png" });

  await browser.close();
})();

import { expect, test } from "@playwright/test";

test.describe("Speedometer UI & Layout", () => {
  test.beforeEach(async ({ page }) => {
    // Inject mocks BEFORE the page loads scripts to pass startup checks
    await page.addInitScript(() => {
      // 1. Mock GeolocationCoordinates.prototype.speed
      if (typeof GeolocationCoordinates === "undefined") {
        // biome-ignore lint/suspicious/noExplicitAny: Mocking global for testing
        (window as any).GeolocationCoordinates = class {};
      }

      Object.defineProperty(GeolocationCoordinates.prototype, "speed", {
        get: () => 0, // Dummy value
        configurable: true,
        enumerable: true,
      });

      // 2. Mock UserAgentData
      Object.defineProperty(navigator, "userAgentData", {
        get: () => ({ mobile: true }),
        configurable: true,
      });

      // 3. Clear storage
      localStorage.clear();
    });

    await page.goto("/");
  });

  test("Initial text consistency and case", async ({ page }) => {
    const unitBtn = page.locator("#unit");
    await expect(unitBtn).toBeVisible();
    await expect(unitBtn).toHaveText("mph");

    const popover = page.locator("#vibe-warning");
    await expect(popover).toBeVisible();

    const heading = popover.locator("h2");
    await expect(heading).toHaveText("Heads up!");
    await expect(popover).toContainText("vibecoded");
  });

  test("Landscape Layout - Browser Mode (Wide)", async ({ page }) => {
    // Force landscape viewport
    await page.setViewportSize({ width: 800, height: 400 });

    const popover = page.locator("#vibe-warning");
    if (!(await popover.isVisible())) {
      await page.locator(".info-btn").click();
    }
    await expect(popover).toBeVisible();

    const maxWidthStr = await popover.evaluate((el) => {
      return getComputedStyle(el).maxWidth;
    });

    // Parse pixel value to handle sub-pixel rendering (e.g., 699.73px)
    const maxWidth = parseFloat(maxWidthStr);
    expect(maxWidth).toBeCloseTo(700, 0); // Within 0.5px (default precision is 2 digits)
  });
});

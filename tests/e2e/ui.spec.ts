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
      // Prevent auto-opening of the popover to ensure consistent test state
      localStorage.setItem("info-popover-shown", "true");
    });

    await page.goto("/");
  });

  test("Initial text consistency and case", async ({ page }) => {
    // Ensure portrait mode for this test to check default UI elements
    await page.setViewportSize({ width: 375, height: 667 });

    const unitBtn = page.locator("#unit");
    await expect(unitBtn).toBeVisible();
    await expect(unitBtn).toHaveText("mph");

    const popover = page.locator("#info-popover");
    // Popover is now suppressed by default in test setup, so we open it manually
    await page.locator(".info-btn").click();
    await expect(popover).toBeVisible();

    const heading = popover.locator("h2");
    await expect(heading).toHaveText("Info");
    await expect(popover).toContainText("Location data stays on your device");
  });

  test("Landscape Layout - Browser Mode (Wide)", async ({ page }) => {
    // Force landscape viewport
    await page.setViewportSize({ width: 800, height: 400 });

    const popover = page.locator("#info-popover");
    if (!(await popover.isVisible())) {
      await page.locator(".info-btn").click();
    }
    await expect(popover).toBeVisible();

    const maxWidthStr = await popover.evaluate((el) => {
      return getComputedStyle(el).maxWidth;
    });

    // Parse pixel value to handle sub-pixel rendering (e.g., 699.73px)
    const maxWidth = parseFloat(maxWidthStr);
    // Relax check to account for varying viewport widths in mobile emulation
    expect(maxWidth).toBeGreaterThan(600);
    expect(maxWidth).toBeLessThanOrEqual(700.5);
  });
});

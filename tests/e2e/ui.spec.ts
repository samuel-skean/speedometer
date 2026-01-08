import { expect, test } from "@playwright/test";

test.describe("Speedometer UI & Layout", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);

    // Inject mocks BEFORE the page loads scripts to pass startup checks
    await page.addInitScript(() => {
      // Enable Test Mode to bypass strict device checks
      // biome-ignore lint/suspicious/noExplicitAny: Mocking global for testing
      (window as any).__TEST_MODE__ = true;

      // 1. Mock GeolocationCoordinates.prototype.speed
      // Ensure the global exists if missing
      if (typeof GeolocationCoordinates === "undefined") {
        // biome-ignore lint/suspicious/noExplicitAny: Mocking global for testing
        (window as any).GeolocationCoordinates = class {};
      }

      // We need to make sure the property is defined on the prototype so Object.getOwnPropertyDescriptor works
      try {
        // biome-ignore lint/suspicious/noExplicitAny: Mocking global for testing
        const proto = (window as any).GeolocationCoordinates.prototype;
        // Check if it already has the property to avoid redefine errors if not configurable
        const descriptor = Object.getOwnPropertyDescriptor(proto, "speed");
        if (!descriptor) {
          Object.defineProperty(proto, "speed", {
            get: () => 0,
            configurable: true,
            enumerable: true,
          });
        }
      } catch (e) {
        console.error(
          "Failed to mock GeolocationCoordinates.prototype.speed",
          e,
        );
      }

      // 2. Mock UserAgentData
      if (!("userAgentData" in navigator)) {
        Object.defineProperty(navigator, "userAgentData", {
          get: () => ({ mobile: true }),
          configurable: true,
        });
      } else {
        // Override existing if needed, or assume environment is ok?
        // In playwright browser, it might have it but empty or undefined mobile.
        Object.defineProperty(navigator, "userAgentData", {
          get: () => ({ mobile: true }),
          configurable: true,
        });
      }

      // 3. Mock Geolocation
      if (!("geolocation" in navigator)) {
        // biome-ignore lint/suspicious/noExplicitAny: Mocking global for testing
        (navigator as any).geolocation = {
          // biome-ignore lint/suspicious/noExplicitAny: Mocking global for testing
          watchPosition: (_success: any) => {},
          clearWatch: () => {},
        };
      }

      // Force User Agent to mobile if userAgentData is not enough (fallback)
      Object.defineProperty(navigator, "userAgent", {
        get: () =>
          "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
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

import { expect, test } from "@playwright/test";

test.describe("Speedometer Null Speed Handling", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);

    // Inject mocks BEFORE the page loads scripts to pass startup checks
    await page.addInitScript(() => {
      // Enable Test Mode to bypass strict device checks
      (window as any).__TEST_MODE__ = true;

      // Mock Geolocation
      (window as any).__geoSuccessCallback = null;

      const mockGeolocation = {
        watchPosition: (success: any) => {
          (window as any).__geoSuccessCallback = success;
          return 123;
        },
        clearWatch: () => {},
        getCurrentPosition: () => {},
      };

      try {
        Object.defineProperty(navigator, "geolocation", {
          value: mockGeolocation,
          configurable: true,
        });
      } catch (e) {
        console.error("Failed to mock navigator.geolocation:", e);
      }

      // Clear storage
      localStorage.clear();
      localStorage.setItem("info-popover-shown", "true");
    });

    await page.goto("/");
  });

  test("Updates to placeholder when speed becomes null", async ({ page }) => {
    // Wait for watchPosition to be called
    await page.waitForFunction(() => (window as any).__geoSuccessCallback !== null, null, { timeout: 5000 });

    // 1. Send valid speed (10 m/s approx 22 mph)
    await page.evaluate(() => {
      const position = {
        coords: {
          speed: 10,
          accuracy: 5,
          latitude: 0,
          longitude: 0,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
        },
        timestamp: Date.now(),
      };
      (window as any).__geoSuccessCallback(position);
    });

    const speedEl = page.locator("#speed");
    await expect(speedEl).not.toHaveText("———");
    await expect(speedEl).not.toHaveText("0"); // 10 m/s is not 0

    // 2. Send null speed
    await page.evaluate(() => {
      const position = {
        coords: {
          speed: null,
          accuracy: 10,
          latitude: 0,
          longitude: 0,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
        },
        timestamp: Date.now(),
      };
      (window as any).__geoSuccessCallback(position);
    });

    // 3. Verify it shows placeholder
    await expect(speedEl).toHaveText("———", { timeout: 2000 });
  });
});

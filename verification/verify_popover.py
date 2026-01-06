
import asyncio
from playwright.async_api import async_playwright, expect

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Create a context with iPhone 16 viewport
        context = await browser.new_context(
            viewport={"width": 393, "height": 852},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        )
        page = await context.new_page()

        # Inject script to bypass checks
        await page.add_init_script("""
            Object.defineProperty(GeolocationCoordinates.prototype, 'speed', {
                get: function() { return 10.0; }
            });
            Object.defineProperty(navigator, 'userAgentData', {
                get: function() { return { mobile: true }; }
            });
        """)

        # Navigate to the app
        await page.goto("http://localhost:5173")

        # Wait for app to load (checking for a known element)
        await expect(page.locator(".info-btn")).to_be_visible()

        # Click the info button
        await page.locator(".info-btn").click()

        # Wait for popover
        await expect(page.locator("#info-popover")).to_be_visible()

        # Take screenshot of the popover
        await page.screenshot(path="verification/info_popover_ios.png")

        # Also check landscape mode
        context_landscape = await browser.new_context(
            viewport={"width": 852, "height": 393},
             user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        )
        page_land = await context_landscape.new_page()
        await page_land.add_init_script("""
            Object.defineProperty(GeolocationCoordinates.prototype, 'speed', {
                get: function() { return 10.0; }
            });
             Object.defineProperty(navigator, 'userAgentData', {
                get: function() { return { mobile: true }; }
            });
        """)

        await page_land.goto("http://localhost:5173")
        await page_land.locator(".info-btn").click()
        await expect(page_land.locator("#info-popover")).to_be_visible()
        await page_land.screenshot(path="verification/info_popover_ios_landscape.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())

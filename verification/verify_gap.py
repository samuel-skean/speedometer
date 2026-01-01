
import asyncio
from playwright.async_api import async_playwright, expect

async def verify_gap():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # Use a mobile User Agent in the context creation
        ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"

        context = await browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent=ua,
            permissions=["geolocation"]
        )
        page = await context.new_page()

        # Mock GeolocationCoordinates prototype check and userAgentData
        await page.add_init_script("""
            // Mock GeolocationCoordinates
            class MockCoordinates {
                get speed() { return 0; }
                get latitude() { return 37.7749; }
                get longitude() { return -122.4194; }
                get accuracy() { return 10; }
                get altitude() { return null; }
                get altitudeAccuracy() { return null; }
                get heading() { return null; }
            }
            // Overwrite the global
            Object.defineProperty(window, 'GeolocationCoordinates', {
                value: MockCoordinates,
                writable: true,
                configurable: true
            });

            // Mock userAgentData
            try {
                Object.defineProperty(navigator, 'userAgentData', {
                    get: () => ({ mobile: true, brands: [], platform: "iOS" }),
                    configurable: true
                });
            } catch (e) {
                console.log("Could not mock userAgentData: " + e);
            }
        """)

        try:
            await page.goto("http://localhost:5173/")

            # Check debug info
            debug_info = await page.evaluate("""() => ({
                hasNativeSpeed: (function() {
                    try {
                        const d = Object.getOwnPropertyDescriptor(GeolocationCoordinates.prototype, 'speed');
                        return !!d && (typeof d.get === 'function' || 'value' in d);
                    } catch(e) { return e.toString(); }
                })(),
                isLikelyGps: (function() {
                   const uaData = navigator.userAgentData;
                   if (uaData && typeof uaData.mobile === 'boolean') return uaData.mobile;
                   return /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                })(),
                ua: navigator.userAgent
            })""")
            print(f"Debug Info: {debug_info}")

            # Dismiss popover
            try:
                got_it_btn = page.get_by_role("button", name="Got it")
                if await got_it_btn.is_visible(timeout=5000):
                    print("Dismissing popover...")
                    await got_it_btn.click()
                    await page.wait_for_timeout(1000)
            except Exception as e:
                print(f"Popover not found or already dismissed: {e}")

            # Wait for controls
            controls = page.locator(".bottom-right-controls")

            # Check for unsupported again
            if await page.locator(".unsupported").is_visible():
                print("STILL UNSUPPORTED")
                await page.screenshot(path="verification/unsupported_debug_2.png")
                return

            await expect(controls).to_be_visible()

            # Verify gap
            gap = await controls.evaluate("element => getComputedStyle(element).gap")
            print(f"Computed gap: {gap}")

            await page.locator(".bottom-bar").screenshot(path="verification/bottom_bar_gap.png")

            if gap == "20px":
                print("SUCCESS: Gap is 20px")
            else:
                print(f"FAILURE: Gap is {gap}")

        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path="verification/error.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_gap())

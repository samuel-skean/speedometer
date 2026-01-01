import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    # iPhone 16 Pro Max viewport (landscape)
    # Resolution: 2868 x 1320
    # Logical width: 956 (440 height)
    # However, browser bars reduce effective height.
    # Standard Safari Landscape height is often smaller than 440.
    # We will test 956x440.

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={'width': 956, 'height': 440},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
            device_scale_factor=3,
            is_mobile=True,
            has_touch=True
        )

        page = await context.new_page()

        # Inject mock for geolocation/wakeLock to avoid startup errors
        await page.add_init_script("""
            navigator.wakeLock = {
                request: async () => ({ release: async () => {} })
            };
            navigator.geolocation.watchPosition = (success) => {
                // Mock position
                success({
                    coords: {
                        latitude: 37.7749,
                        longitude: -122.4194,
                        altitude: 0,
                        accuracy: 10,
                        altitudeAccuracy: 10,
                        heading: 0,
                        speed: 25.5, // 25.5 m/s approx 57 mph
                    },
                    timestamp: Date.now()
                });
                return 1;
            };
        """)

        # Load the page
        cwd = os.getcwd()
        await page.goto(f'file://{cwd}/index.html')

        # Wait for rendering
        await page.wait_for_timeout(1000)

        # Measure elements
        speed_box = await page.locator('.speed').bounding_box()
        unit_btn = await page.locator('button.unit').bounding_box()
        bottom_bar = await page.locator('.bottom-bar').bounding_box()

        print(f'Speed Box: {speed_box}')
        print(f'Unit Btn: {unit_btn}')
        print(f'Bottom Bar: {bottom_bar}')

        if unit_btn and bottom_bar:
            gap = bottom_bar['y'] - (unit_btn['y'] + unit_btn['height'])
            print(f'Gap between unit button and bottom bar: {gap}px')

            if gap < 0:
                print('FAIL: Overlap detected with bottom bar container.')
            else:
                print('PASS: No overlap detected.')

        await page.screenshot(path='landscape_verification_new.png')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())


import time
from playwright.sync_api import sync_playwright

def verify_popover_location(page):
    # Mock Geolocation to avoid unsupported message
    page.context.grant_permissions(['geolocation'])
    page.context.set_geolocation({'latitude': 51.5, 'longitude': -0.1, 'accuracy': 100})

    # The app requires a mobile user agent and specific navigator.geolocation speed property support
    # We'll inject a script to mock the speed property if needed, but set_geolocation might handle basic coords.
    # However, app.ts checks for GeolocationCoordinates.prototype.speed specifically.

    page.add_init_script("""
        Object.defineProperty(GeolocationCoordinates.prototype, 'speed', {
            get: function() { return this._speed || 0; },
            set: function(v) { this._speed = v; },
            configurable: true
        });

        // Mock wake lock
        navigator.wakeLock = {
            request: async () => ({
                addEventListener: () => {},
                release: () => {}
            })
        };
    """)

    page.goto("http://localhost:5173")

    # Wait for app to init
    # The first time, it might auto-show the popover if not in localStorage.
    # But we are in a fresh context.

    # Check if popover is visible
    popover = page.locator("#vibe-warning")

    # Wait a bit for auto-show logic
    time.sleep(2)

    if popover.is_visible():
        print("Popover auto-shown on first launch")
        # Close it
        page.get_by_role("button", name="Got it").click()
        time.sleep(1)

    # Now click the info button to open it
    info_btn = page.locator(".info-btn")
    info_btn.click()

    # Wait for transition to start/happen
    # We want to verify the start position, but that's hard with screenshots in static form.
    # However, we can take a screenshot while it is open.
    # The main thing is to ensure it opens and doesn't crash, and the click listener works.

    time.sleep(0.5)
    page.screenshot(path="verification/popover_open.png")
    print("Screenshot taken")

if __name__ == "__main__":
    with sync_playwright() as p:
        # Use mobile emulation to pass "isLikelyGpsDevice" check
        iphone_13 = p.devices['iPhone 13']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**iphone_13)
        page = context.new_page()

        try:
            verify_popover_location(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

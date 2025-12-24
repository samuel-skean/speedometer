
import time
from playwright.sync_api import sync_playwright

def verify_stale_data_warning():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 375, "height": 667})
        page = context.new_page()

        # Mock geolocation with Object.defineProperty to bypass read-only checks
        page.add_init_script("""
            const mockGeo = {
                getCurrentPosition: (success) => {
                    success({
                        coords: {
                            latitude: 37.7749,
                            longitude: -122.4194,
                            accuracy: 10,
                            speed: 20, // 20 m/s
                            altitude: null,
                            altitudeAccuracy: null,
                            heading: null
                        },
                        timestamp: Date.now()
                    });
                },
                watchPosition: (success) => {
                    console.log("Mock watchPosition called");
                    // Call immediately
                    success({
                        coords: {
                            latitude: 37.7749,
                            longitude: -122.4194,
                            accuracy: 10,
                            speed: 20,
                            altitude: null,
                            altitudeAccuracy: null,
                            heading: null
                        },
                        timestamp: Date.now()
                    });
                    return 1; // watchId
                },
                clearWatch: () => {}
            };

            try {
                Object.defineProperty(navigator, 'geolocation', {
                    value: mockGeo,
                    configurable: true
                });
                console.log("Mocked navigator.geolocation");
            } catch (e) {
                console.error("Failed to mock geolocation:", e);
            }
        """)

        page.on("console", lambda msg: print(f"Console: {msg.text}"))

        try:
            page.goto("http://localhost:4173")

            print("Waiting for initial GPS fix...")
            # Expect speed to be 20 m/s converted to mph (approx 45) or kph.
            # 20 * 2.237 = 44.7 -> 45
            try:
                page.wait_for_selector("#speed:has-text('45')", timeout=5000)
                print("Speed updated to 45 mph.")
            except:
                print("Timed out waiting for specific speed. Checking content.")
                print(f"Speed content: {page.text_content('#speed')}")
                print(f"Status content: {page.text_content('#status')}")

            # Now lastUpdateTimestamp is set.

            print("Simulating time passing for warning (11s)...")
            time.sleep(11)

            # Check if warning is visible
            warning = page.locator("#warning")
            if warning.is_visible():
                print("Warning is visible!")
                text = warning.text_content()
                print(f"Warning text: {text}")

                # Take screenshot
                page.screenshot(path="verification/warning_seconds.png")

                # Override Date.now to return a future time for minutes check
                print("Simulating +65 seconds...")
                page.evaluate("""
                    window._originalNow = Date.now;
                    Date.now = () => window._originalNow() + 65000;
                """)

                # Wait for the interval to tick (1s)
                time.sleep(1.5)

                text_min = warning.text_content()
                print(f"Warning text after 65s: {text_min}")
                page.screenshot(path="verification/warning_minutes.png")

                # Override Date.now for Hours
                print("Simulating +2 hours...")
                page.evaluate("""
                    Date.now = () => window._originalNow() + (2 * 60 * 60 * 1000) + 1000;
                """)
                time.sleep(1.5)
                text_hr = warning.text_content()
                print(f"Warning text after 2h: {text_hr}")
                page.screenshot(path="verification/warning_hours.png")

            else:
                print("Warning not visible.")
                page.screenshot(path="verification/failed_warning.png")

        finally:
            browser.close()

if __name__ == "__main__":
    verify_stale_data_warning()

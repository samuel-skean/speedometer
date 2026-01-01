
import os
from playwright.sync_api import sync_playwright, expect

def verify_fix():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create context with mobile viewport AND mock feature detection
        context = browser.new_context(
            viewport={'width': 375, 'height': 812},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
        )

        # We need to inject the mock BEFORE any page load or script execution
        # to pass the strict hasNativeSpeedField() and isLikelyGpsDevice() checks
        context.add_init_script("""
            // 1. Mock Geolocation with 'speed' in prototype
            const coordsProto = window.GeolocationCoordinates ? window.GeolocationCoordinates.prototype : {};

            // If GeolocationCoordinates doesn't exist (some environments), mock it
            if (!window.GeolocationCoordinates) {
                window.GeolocationCoordinates = class {};
            }

            // Add 'speed' getter to prototype to pass `Object.getOwnPropertyDescriptor(coordsCtor.prototype, "speed")`
            Object.defineProperty(window.GeolocationCoordinates.prototype, 'speed', {
                get: function() { return 0; },
                enumerable: true,
                configurable: true
            });

            // 2. Mock Navigator.geolocation
            const mockGeo = {
                getCurrentPosition: (success) => success({
                    coords: {
                        latitude: 37.7749,
                        longitude: -122.4194,
                        accuracy: 10,
                        speed: 0,
                        heading: 0
                    },
                    timestamp: Date.now()
                }),
                watchPosition: (success) => {
                    success({
                        coords: {
                            latitude: 37.7749,
                            longitude: -122.4194,
                            accuracy: 10,
                            speed: 0,
                            heading: 0
                        },
                        timestamp: Date.now()
                    });
                    return 1;
                },
                clearWatch: () => {}
            };

            // Override navigator.geolocation
            Object.defineProperty(navigator, 'geolocation', {
                get: () => mockGeo
            });

            // 3. Mock UserAgentData (optional, but good for robustness)
            Object.defineProperty(navigator, 'userAgentData', {
                get: () => ({ mobile: true })
            });
        """)

        page = context.new_page()

        try:
            # Navigate
            page.goto("http://localhost:5173")

            # Debug: Screenshot initial state
            os.makedirs("/home/jules/verification", exist_ok=True)
            page.screenshot(path="/home/jules/verification/debug_initial.png")

            # Wait for app to load
            # If ".speed" is not visible, it might be showing ".unsupported".
            # Let's check for unsupported message just in case
            if page.locator(".unsupported").is_visible():
                print("App is showing 'Unsupported Device' message.")
                # We can't verify the popover if the app didn't init.
                # However, the fix is in index.html (CSS), so technically the styles exist.
                # But we can't click the button.
                # Let's try to verify CSS directly on the page if we can't get to the UI.
                pass
            else:
                expect(page.locator(".speed")).to_be_visible(timeout=5000)

                # Open popover
                info_btn = page.locator("button[aria-label='Show info']")
                # If the app didn't init, this won't exist.
                expect(info_btn).to_be_visible()
                info_btn.click()

                expect(page.locator("#vibe-warning")).to_be_visible()

            # Verify CSS
            backdrop_filter = page.evaluate("""() => {
                const popover = document.querySelector('.vibe-warning-popover');
                // Even if not open, we can check computed style, but it's better if open.
                // If the app failed to load JS, the popover element still exists in HTML.
                if (!popover) return "ELEMENT_NOT_FOUND";

                const style = window.getComputedStyle(popover, '::backdrop');
                return style.backdropFilter || style.webkitBackdropFilter || 'none';
            }""")

            print(f"Backdrop filter: {backdrop_filter}")

            meta_content = page.get_attribute("meta[name='apple-mobile-web-app-status-bar-style']", "content")
            print(f"Meta tag: {meta_content}")

            if backdrop_filter != 'none' and backdrop_filter != "ELEMENT_NOT_FOUND":
                 # Check if it's explicitly 'none' or empty string (some browsers return empty string for none)
                 if backdrop_filter != "":
                     print(f"FAIL: Backdrop filter found: {backdrop_filter}")

            if meta_content == "black-translucent":
                print("PASS: Meta tag correct")
            else:
                print("FAIL: Meta tag incorrect")

            page.screenshot(path="/home/jules/verification/ios_fix_verify.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error_retry.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_fix()

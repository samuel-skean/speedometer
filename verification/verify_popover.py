
from playwright.sync_api import sync_playwright

def verify_popover(page):
    # Mocking environment to ensure consistency
    page.add_init_script("""
    Object.defineProperty(navigator, 'userAgentData', {
        get: () => ({ mobile: true }),
        configurable: true
    });
    // Mock iOS UserAgent for testing iOS specific instructions
    Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        configurable: true
    });
    localStorage.clear();
    """)

    page.goto("http://localhost:5173")

    # Wait for the popover to appear (it should auto-appear on first load for mobile)
    # But init script might block it if we are not "standalone" but logic checks might vary.
    # Logic: shouldShow = !hasShownInfo && !isStandalone().
    # We cleared local storage. isStandalone() returns false in browser.
    # So it should appear.

    page.wait_for_selector("#info-popover:popover-open", timeout=5000)

    # Take screenshot of the popover
    page.screenshot(path="verification/popover_ios.png")

    # Now close and reopen to test 'Got it' functionality if needed,
    # but for visual verification of layout, one screenshot is good.

    # Let's also check Android logic
    page.evaluate("localStorage.clear()")
    page.reload()

    # We need to change the mock, but add_init_script is persistent for the context?
    # Actually, reloading might re-apply init script.
    # To test Android, we'd need a new context or dynamic mock.

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 375, "height": 667}) # iPhone dimensions
        try:
            verify_popover(page)
        finally:
            browser.close()

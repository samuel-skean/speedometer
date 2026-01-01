
import time
from playwright.sync_api import sync_playwright

def verify_bug(page):
    # 1. Clear storage to simulate first run
    page.goto("http://localhost:5173")
    page.evaluate("localStorage.clear()")
    page.reload()

    # 2. Wait for auto-show
    popover = page.locator("#vibe-warning")
    popover.wait_for(state="visible", timeout=5000)
    print("Auto-show confirmed.")

    # 3. Dismiss
    page.get_by_role("button", name="Got it").click()
    popover.wait_for(state="hidden")
    print("Dismissed.")

    # 4. Reload page (simulate new session where it should NOT auto-show)
    page.reload()

    # Wait for init
    page.wait_for_load_state("domcontentloaded")
    time.sleep(1) # Wait for JS init

    # 5. Check CSS vars BEFORE interaction
    # They should be unset or empty string if my theory is correct (that init doesn't set them)
    # The previous fix relied on click listener.
    exit_x = popover.evaluate("el => el.style.getPropertyValue('--exit-x')")
    print(f"Before click, --exit-x is: '{exit_x}'")

    # If exit_x is empty, it means we rely on the click listener.
    # If the click listener fails to fire before the popover opens, the animation will be wrong (0,0).

    # 6. Click to open
    info_btn = page.locator(".info-btn")
    info_btn.click()

    # 7. Check immediately
    # We want to know what the style was when the browser calculated the start state.
    # But we can only check the current style.
    exit_x_after = popover.evaluate("el => el.style.getPropertyValue('--exit-x')")
    print(f"After click, --exit-x is: '{exit_x_after}'")

    if not exit_x_after:
        print("FAIL: --exit-x not set after click!")
    else:
        print("SUCCESS: --exit-x set after click.")

if __name__ == "__main__":
    with sync_playwright() as p:
        iphone_13 = p.devices['iPhone 13']
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(**iphone_13)
        page = context.new_page()
        try:
            verify_bug(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

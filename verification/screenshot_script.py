from playwright.sync_api import sync_playwright

def verify():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Emulate iPhone in landscape with constrained height
        context = browser.new_context(
            viewport={'width': 852, 'height': 320},
            device_scale_factor=3,
            is_mobile=True,
            has_touch=True
        )
        page = context.new_page()
        page.goto('http://localhost:8080')
        page.wait_for_selector('.speed')

        # Take screenshot
        page.screenshot(path='verification/landscape_verification.png')
        browser.close()

if __name__ == '__main__':
    verify()

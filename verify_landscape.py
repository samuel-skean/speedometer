import sys
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

        # Get bounding boxes
        speed_box = page.locator('.speed').bounding_box()
        unit_box = page.locator('#unit').bounding_box()
        bottom_bar_box = page.locator('.bottom-bar').bounding_box()
        status_box = page.locator('#status').bounding_box()

        print(f"Viewport Height: 320")
        print(f"Speed: y={speed_box['y']:.2f}, h={speed_box['height']:.2f}, bottom={speed_box['y'] + speed_box['height']:.2f}")
        print(f"Unit: y={unit_box['y']:.2f}, h={unit_box['height']:.2f}, bottom={unit_box['y'] + unit_box['height']:.2f}")
        print(f"Bottom Bar: y={bottom_bar_box['y']:.2f}")
        print(f"Status: y={status_box['y']:.2f}")

        unit_bottom = unit_box['y'] + unit_box['height']
        gap_unit_bar = bottom_bar_box['y'] - unit_bottom
        gap_unit_status = status_box['y'] - unit_bottom

        print(f"Gap Unit-Bar: {gap_unit_bar:.2f}px")
        print(f"Gap Unit-Status: {gap_unit_status:.2f}px")

        browser.close()

if __name__ == '__main__':
    verify()

Icon placeholders for the Speedometer PWA

Files required:
- icon-192.png (192x192, PNG)
- icon-512.png (512x512, PNG)

Guidelines:
- Use a square canvas with transparent background.
- Prefer a simple, high-contrast symbol (e.g., circular dial with a needle).
- Keep important artwork within the safe area (~80% center) for maskable icons.
- Avoid fine details that won’t be visible at small sizes.
- Export as PNG, no alpha premultiplication issues (standard transparency is fine).

Maskable icons:
- These icons are referenced with "purpose": "any maskable" in the manifest.
- Ensure the artwork fits nicely when masked (rounded shapes are best).
- Leave some padding around the edges so nothing is clipped.

Quick generation tips:
- Use any vector editor (Figma, Sketch, Illustrator) or a simple raster editor.
- Create the 512x512 first, then downscale to 192x192 to maintain consistency.
- Consider a dark background (#111) or transparent; the app uses a dark theme.

Testing:
- After placing icons, open the app and check browser install prompt (Add to Home Screen).
- Verify how the icon looks on Android and iOS (iOS uses the apple-touch-icon and may apply its own mask/rounding).
- Ensure manifest paths are correct:
  - icons/icon-192.png
  - icons/icon-512.png

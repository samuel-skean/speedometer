# Agent Instructions

## Testing
* **Do not test for specific text content in UI tests.** UI text is subject to frequent change. Tests should verify layout, visibility, and existence of critical elements (e.g., popovers, buttons) rather than the exact wording.
* **Focus on OS detection and functional logic.** Ensure that platform-specific features (like PWA instructions) are correctly triggered based on the environment, not just that the text says "iOS" or "Android".

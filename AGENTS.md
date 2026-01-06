# Agent Instructions

## Verification

Always ensure that all checks in the GitHub Actions run successfully. You should simulate this locally before submitting.

- **Tests**: Run `npm run test` to execute the unit tests.
- **Linter**: Run `npx biome ci .` (or `npx biome check --write` to fix issues) to ensure code style and linting compliance.
## Versioning
- The version number should be defined only once, in `package.json`. The service worker reads the value from there during the build.
- Always increment the version number in `package.json` every time you make a change.

## Testing
* **Do not test for specific text content in UI tests.** UI text is subject to frequent change. Tests should verify layout, visibility, and existence of critical elements (e.g., popovers, buttons) rather than the exact wording.
* **Focus on OS detection and functional logic.** Ensure that platform-specific features (like PWA instructions) are correctly triggered based on the environment, not just that the text says "iOS" or "Android".

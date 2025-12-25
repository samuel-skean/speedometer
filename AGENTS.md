# Agent Instructions

## Verification

Always ensure that all checks in the GitHub Actions run successfully. You should simulate this locally before submitting.

- **Tests**: Run `npm run test` to execute the unit tests.
- **Linter**: Run `npx biome ci .` (or `npx biome check --write` to fix issues) to ensure code style and linting compliance.

# Agent Instructions

## Verification

Always ensure that all checks in the GitHub Actions run successfully. You should simulate this locally before submitting.

- **Tests**: Run `npm run test` to execute the unit tests.
- **Linter**: Run `npx biome ci .` (or `npx biome check --write` to fix issues) to ensure code style and linting compliance.
## Versioning
- Always bump the patch version in both `package.json` and `src/service-worker.ts` (the `CACHE_VERSION` constant) whenever you make a change.

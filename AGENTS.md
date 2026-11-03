# Volvo Cars Card

<!-- workspace-pointer -->
## Shared workspace rules

Part of the bitosome Home Assistant workspace. Shared rules, access (SSH, ha-mcp) and processes
are in `../AGENTS.md` (the workspace entry point) and `../home-assistant-knowledge/`; they take
precedence over this file. Build, test, release and known gotchas for this repo:
[repo catalog](../home-assistant-knowledge/docs/repo-catalog.md#volvo-cars-card).

- Edit and release from this checkout; never patch production directly.
- Push, tag/release, HACS install, production changes, reloads and restarts need the owner's explicit approval.
- Shared UI comes from `@bitosome/ha-card-ui` (exact release tarball pin). Build anything two or more cards use there first; follow `../home-assistant-knowledge/docs/card-style-guide.md`.
- After a release or install, update `docs/current-state.md` and `docs/changelog.md` in the knowledge repo.

This repository owns the standalone Lovelace card for the official Home Assistant Volvo
integration. Use Space Hub Card as the canonical design reference; the versioned `@bitosome/ha-card-ui` package owns shared tokens, glows, components
and modal behavior. `src/shared/` contains compatibility exports. Update the package
and rebuild rather than creating local copies or competing behavior.

The card is a view and a set of explicit actions. It must never guess an entity: derive
the Volvo ids from the configured car prefix, honour per-slot overrides, and show a
missing or unavailable entity as unavailable. It must never send a command while
loading; only a press acts, and a press is refused when its entity is unavailable.

Keep physical actions out of tests: use mocked Home Assistant states and services with
happy-dom. Never commit a real dashboard, household identifiers, registration plates,
tokens or API dumps — examples use generic entities.

Run `npm run check` (typecheck, build and tests against the built bundle) before
publishing. The release workflow publishes `dist/volvo-cars-card.js` for a `v*` tag that
matches `package.json`, so `dist/` stays out of the default branch.

## Publishing

Commit and push every change. A change a user can see - card behaviour, integration
code, entity or service contracts - also gets a version bump and an annotated
`v<version>` tag, because HACS installs from releases: do not wait to be asked for a
release. Docs-only changes are pushed without a release. After pushing a tag, confirm
the release workflow succeeded and that the asset is attached.

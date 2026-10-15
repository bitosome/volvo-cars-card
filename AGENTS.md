# Volvo Cars Card

This repository owns the standalone Lovelace card for the official Home Assistant Volvo
integration. Use Space Hub Card as the canonical design reference; `src/shared/` is
vendored from it and must retain provenance — synchronize from the canonical source
rather than editing the copies by hand or creating a competing design system.

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

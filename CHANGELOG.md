# Changelog

## 0.7.0 — 2026-10-25

- Bundle the versioned `@bitosome/ha-card-ui` package for Space Hub tokens, activation glows, reusable feedback and modal behavior.
- Use one shared navigation controller and native modal shell for Details, Climate and bound Unlock confirmations; X, Escape and backdrop share one dismissal policy.
- Keep the dashboard stable while details scroll, restore focus on close and hand off to Home Assistant more-info without competing top layers.
- Preserve vehicle-state interpretation, explicit commands and pending acknowledgement safeguards.

## 0.6.7 — 2026-10-25

- Use shared Space Hub actions and native dialog geometry, safe-area margins, bounded content scrolling and focus restoration.
- Add the same MDI X to unlock confirmation; preserve Cancel as the initial focus and keep dismissal separate from vehicle commands.
- Support deliberate backdrop dismissal and release modal ownership before Home Assistant more-info.
- Preserve charging interpretation, open-door chips and current-state lock icons.
- Validate 74 frontend tests plus 320px details and short mobile confirmation fixtures.

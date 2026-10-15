# Volvo Cars Card

A calm, car-first Home Assistant card for the official Volvo integration, in the Space Hub design language used by the other bitosome cards. One card shows one car as a **single dense status row** — thumbnail, name, battery and range, the chips that matter, and the lock — and expands only when something needs attention.

It reads the Volvo integration's entities and **only acts when you press something** — nothing is sent to the car while the dashboard is open, and a missing or unavailable entity is shown as unavailable instead of being guessed.

## Install

1. HACS → **Custom repositories** → `https://github.com/bitosome/volvo-cars-card`, category **Dashboard** → download the latest release.
2. Reload the browser, then add **Volvo Cars Card** to a dashboard.

Manual install: build with `npm ci && npm run build`, copy `dist/volvo-cars-card.js` to `/config/www/`, and register `/local/volvo-cars-card.js` as a JavaScript module resource.

## Configure

```yaml
type: custom:volvo-cars-card
car: ex30                 # everything below is derived from this
layout: compact           # compact (default) is one dense row; full is the hero layout
name: Volvo EX30          # optional; defaults to the lock's own name
image: /api/image/serve/cfc5e4693a59de8d2a662b2391509297/original
show: [charging, openings, actions]   # optional; this is the default
```

`car: ex30` derives every entity from the integration's naming, so `lock.volvo_ex30_lock`, `sensor.volvo_ex30_battery`, `sensor.volvo_ex30_charging_power`, `binary_sensor.volvo_ex30_tank_lid`, `button.volvo_ex30_flash` and the rest are found without listing them. Use `car: xc40` for the other car, or `prefix: volvo_ex30_` if the car key does not match the entity prefix.

Optional keys:

| Key | Meaning |
| --- | --- |
| `name` | Display name. Defaults to the lock entity's friendly name without “Lock”. |
| `image` | Picture URL. Defaults to the `entity_picture` of `image_entity`. |
| `image_entity` | Entity whose picture is used. Defaults to the car's `device_tracker.…_location`. |
| `entities` | Per-slot overrides, e.g. `{lock: lock.other, battery: sensor.other_battery}`. Slots: `lock`, `battery`, `range`, `odometer`, `charging_connection`, `charging_status`, `charging_power`, `charging_power_status`, `charging_type`, `charging_time`, `charging_target`. |
| `show` | Which detail rows the disclosure can show: `charging`, `openings`, `actions`, `odometer`. Defaults to the first three. |
| `layout` | `compact` (default) or `full`. `full` is the hero card with the large picture and the rows always open. |

### Pictures

The Volvo integration exposes no image entity. Uploaded pictures live in Home Assistant and are served at `/api/image/serve/<id>/original`, which is what this card uses by default when the tracker carries an `entity_picture`. Any `/local/...` file or absolute URL also works.

## What it shows

**Compact (default)** — one row, four zones:

- a 96×54 thumbnail cropped from the car picture (`object-fit: cover`), or an MDI car icon when no picture is configured;
- the name, the battery percentage as the figure that matters with a thin level bar and the charge-target marker, and distance-to-empty beside it;
- chips, only when they carry information: plugged in (`kW` while charging, otherwise *Plugged*), *N open* when something is open, and a fault chip;
- the lock as a compact icon pill — optimistic *Locking…*/*Unlocking…*, refused when the lock is unavailable.

Nothing abnormal means nothing extra: a normal car is a single row (**74 px** at 500 px wide). Anything that needs attention adds at most one quiet line that names what changed — *"front left door, charge port open."* or *"Charger fault — check the cable and the charging station."* (worst case measured: **111 px**).

Everything else is behind the chevron: the `show` rows (charging detail, the full openings list, odometer, quick actions) are collapsed until you expand them. Tapping the identity opens more-info for the battery, the thumbnail for the car's location.

**`layout: full`** is the hero card — large picture, battery and range as figures, and the rows always open (227 px at 500 px wide).

In both layouts:

- **Charging** — plugged in: state, power and time to target. Not plugged in: a single quiet line. A charger `fault` or `no_power_available` is surfaced as a fault, never as normal charging, and only while the car is actually plugged in.
- **Openings** — quiet when everything is shut. When something is open only those items are listed with their names; the tank lid is labelled **Charge port** because that is what it is on these cars.
- **Quick actions** — flash, honk, honk & flash, precondition and stop precondition. Each button appears only when its entity is configured in the integration and available, so an unsupported car just shows fewer buttons.

## Design

`src/shared/design-tokens.ts` and `src/shared/glow.ts` are vendored from [space-hub-card](https://github.com/bitosome/space-hub-card) (MIT), the canonical source for the tile surfaces, typography, radii, shadows and under-tile glow. `src/styles/card.ts` only lays out this card. Reduced motion is honoured, and colours resolve from Home Assistant's theme variables so light and dark themes both work.

## Develop

```sh
npm ci
npm run check     # typecheck, build, tests
```

`npm run check` builds `dist/volvo-cars-card.js` and runs the test suite against that built bundle with happy-dom, using mocked states and services. Tests never touch a car.

## Licence

MIT

# Volvo Cars Card

A calm, car-first Home Assistant card for the official Volvo integration, in the Space Hub design language used by the other bitosome cards. One card shows one car: by default the **picture leads** as a banner with only the essentials on a scrim, and everything else stays behind a chevron. `layout: compact` is a single dense 92 px row, and `layout: full` is the larger hero card.

It reads the Volvo integration's entities and **only acts when you press something** — nothing is sent to the car while the dashboard is open, and a missing or unavailable entity is shown as unavailable instead of being guessed.

## Install

1. HACS → **Custom repositories** → `https://github.com/bitosome/volvo-cars-card`, category **Dashboard** → download the latest release.
2. Reload the browser, then add **Volvo Cars Card** to a dashboard.

Manual install: build with `npm ci && npm run build`, copy `dist/volvo-cars-card.js` to `/config/www/`, and register `/local/volvo-cars-card.js` as a JavaScript module resource.

## Configure

```yaml
type: custom:volvo-cars-card
car: ex30                 # everything below is derived from this
layout: banner            # banner (default) leads with the picture; compact is one row; full is the hero
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
| `image_size` | `small`, `medium` (default) or `large`. Banner picture: 130 / **160** / 210 px tall. Compact thumbnail: 96×54 / **128×72** / 160×90. |
| `image_height` | Explicit picture height in pixels (32–260), overriding `image_size`; the compact thumbnail derives its width from the 16:9 car pictures. |
| `entities` | Per-slot overrides, e.g. `{lock: lock.other, battery: sensor.other_battery}`. Slots: `lock`, `battery`, `range`, `odometer`, `charging_connection`, `charging_status`, `charging_power`, `charging_power_status`, `charging_type`, `charging_time`, `charging_target`. |
| `show` | Which detail rows the disclosure can show: `charging`, `openings`, `actions`, `odometer`. Defaults to the first three. |
| `layout` | `banner` (default), `compact` or `full`. `full` is the hero card with the rows always open; `compact` is the 92 px row. |

### Pictures

The Volvo integration exposes no image entity. Uploaded pictures live in Home Assistant and are served at `/api/image/serve/<id>/original`, which is what this card uses by default when the tracker carries an `entity_picture`. Any `/local/...` file or absolute URL also works.

## What it shows

**Banner (default)** — a clean picture at **160 px** tall (cropped 16:9, so a 1920×1080 upload shows the car), with nothing written on the car: just a whisper of a bottom gradient so the picture edge separates from the band. Below it, one **information band** (~56 px) holds the name as the anchor, the battery figure with its level bar and charge-target marker, distance-to-empty beside it, and the lock and chevron as light icon buttons — no rings. The maker eyebrow only appears when the name does not already say *Volvo*.

Instead of a stack of chips the band carries **at most one status phrase**, in one accent colour, by priority: a car-reported fault (red, *Plugged · charging fault*) outranks an opening (amber, *Charge port open*, or *2 open*) which outranks simply being plugged in or charging (quiet, *Charging · 11.2 kW*). Below the band there is at most **one** line, and only when it adds something: the attributed fault guidance, or the names when several openings are listed — a single opening is already the phrase. Measured at 500 px wide: **160 px picture + ~56 px band**, so 216 px quiet and 236 px with a fault line. With no picture configured the card is just the band.

**Compact** — one row, four zones:

- a **128×72** thumbnail cropped from the car picture (`object-fit: cover`, so a 1920×1080 upload crops to the car), or an MDI car icon when no picture is configured;
- the name, the battery percentage as the figure that matters with a thin level bar and the charge-target marker, and distance-to-empty beside it;
- chips, only when they carry information: plugged in (`kW` while charging, otherwise *Plugged*), an amber opening chip (*Charge port open*, or *N open* when several), and a red chip **only** for a fault the car reports;
- the lock as a compact icon pill — optimistic *Locking…*/*Unlocking…*, refused when the lock is unavailable.

Nothing abnormal means nothing extra: a normal car is a single row (**92 px** at 500 px wide, 128×72 thumbnail). An opening adds an amber chip — named when there is only one, e.g. *Charge port open* — and several openings add one quiet line naming them (*"front left door, charge port open."*). A fault the **car itself reports** adds a red chip and one line, *"The car reports a charging fault — check the cable and the charging station."* Worst case measured: **139 px** (115 px for an opening alone, 133 px at `image_size: large`).

Everything else is behind the chevron: the `show` rows (charging detail, the full openings list, odometer, quick actions) are collapsed until you expand them. Tapping the identity opens more-info for the battery, the thumbnail for the car's location.

**`layout: full`** is the hero card — large 16:9 picture, battery and range as figures, and the rows always open (398 px at 500 px wide with a picture).

In both layouts:

- **Charging** — plugged in: state, power and time to target. Not plugged in: a single quiet line. A charger `fault` or `no_power_available` is surfaced as a fault, never as normal charging, and only while the car is actually plugged in.
- **Openings** — quiet when everything is shut, and always informational (amber, never the fault treatment). When something is open only those items are named; the tank lid is labelled **Charge port** because that is what it is on these cars. An open charge port is an opening like any other: it never produces a fault chip, a fault line or the red glow.
- **Faults** — red is reserved for what the car reports through its charging sensors. A `fault` is red (*Charging fault*); `no_power_available` while plugged in is amber (*No power*), not a fault. The wording always attributes the reading to the car, so an open port can never read as its cause.
- **A connected cable means the port is open.** Volvo's charge-port sensor lags plug events — it can report closed on a car with a cable in — so while `charging_connection_status` is `connected` the port is never treated as an opening (an open flap there is expected, not a nag) and its "closed" is never used to claim everything is shut. The contradiction is surfaced instead, in the detail tile: *"Charge port sensor reports closed while a cable is connected."*, with the port's entity for more-info. While unplugged the sensor is trusted, so an open port is reported as an ordinary amber opening.
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

# Volvo Cars Card

A Home Assistant dashboard card for the official Volvo integration. One card per car, using the shared Space Hub surfaces, typography, icons and under-tile glows.

Battery, estimated range, cable connection, charging state and open doors/windows are visible together. Lock controls, climate and details stay within reach on phones. The picture supports the overview without hiding the information behind it.

## Install

Add `https://github.com/bitosome/volvo-cars-card` in HACS **Custom repositories**, category **Dashboard**, and download the latest release. Reload the browser, then add **Volvo Cars Card**.

For manual installation, run `npm ci && npm run build`, copy `dist/volvo-cars-card.js` to `/config/www/`, and register `/local/volvo-cars-card.js` as a JavaScript module resource.

## Configuration

```yaml
type: custom:volvo-cars-card
car: ex30
name: Volvo EX30
image: /local/my-car.png
layout: banner
show: [charging, openings, actions, odometer]
```

The card derives entity IDs such as `lock.volvo_ex30_lock` from `car`. It does not search for a similar entity or another car when a reading is missing. `prefix: volvo_my_car_` overrides that naming prefix. Use the visual editor or YAML for renamed entities:

```yaml
entities:
  lock: lock.my_car
  battery: sensor.my_car_battery
openings:
  door_front_left: binary_sensor.my_driver_door
actions:
  start_climatisation: button.my_car_precondition
```

| Option | Meaning |
| --- | --- |
| `car` / `prefix` | Car key or explicit entity prefix; one is required. |
| `name` | Display name; otherwise derived from the lock name. |
| `image` | Image URL; existing HA uploaded-image URLs work. |
| `image_entity` | Entity providing `entity_picture`; defaults to the car's location tracker. |
| `image_size` | `small`, `medium` (default), or `large`. |
| `image_height` | Explicit height, 32–260 px (overview default 140 px). Transparent margins are automatically excluded from framing so the car fills the area; the visible image is contained. Opaque or unreadable cross-origin images keep standard containment. Original image files are unchanged. |
| `layout` | `banner` (overview, default), `compact` (smaller image), or `full` (legacy alias for overview). All open Details in a modal, preserving dashboard position. |
| `show` | Optional detail sections: `charging`, `openings`, `actions`, `odometer`. Defaults to the first three. `[]` hides these extras. Core battery, charging and opening status remain visible. |
| `entities` | Overrides for `lock`, `battery`, `range`, `odometer`, `charging_connection`, `charging_status`, `charging_power`, `charging_power_status`, `charging_type`, `charging_time`, `charging_target`. |
| `openings` | Overrides for `door_front_left/right`, `door_rear_left/right`, `window_front_left/right`, `window_rear_left/right`, `bonnet`, `sunroof`, `tailgate`, `tank_lid`. |
| `actions` | Overrides for `flash`, `honk`, `honk_flash`, `start_climatisation`, `stop_climatisation`. |

Overrides must use the correct domains: lock, sensor, binary_sensor, or button respectively. The tank-lid sensor is presented as the charge port for these electric cars.

## Charging interpretation

The card separates plug connection, charging state and the power signal. A connected cable does not mean charging is running.

Home Assistant explicitly documents that Volvo's `charging_power_status: fault` can occur when a connected charger is paused or not supplying power. That signal alone therefore **does not create a red fault**. An idle connected car shows **Connected · not charging**; the raw power signal and its explanation remain in Details. Normal power states such as `initialization`, `power_available_but_not_activated` and `providing_power` are handled explicitly. See the [official integration's troubleshooting guidance](https://www.home-assistant.io/integrations/volvo/#the-charging_power_status-entity-shows-fault-as-value-or-is-unavailable).

A charging-status `error` or connection `fault` is shown as an error. A disconnected cable makes old charging power/time readings irrelevant; inconsistent raw readings remain available in Details. Scheduled, complete, discharging and unavailable states have distinct labels. Power supports W/kW; remaining-time estimates appear only while charging. The battery target is a reported value, not an editable control.

The Volvo integration does not expose direct start/stop charging commands. Use the charger integration for those; this card does not invent commands or infer charger schedules.

## Openings and controls

- Every open door/window is named in a visible pill; charging information remains visible alongside it.
- An open charge port is expected while a cable is connected. It is excluded from opening warnings in that situation.
- Missing or unavailable readings never become “closed.” Core door/window/tailgate sensors are required for a complete summary; unsupported optional openings are identified in Details.
- **Unlock** asks for confirmation, bound to the same car and action. **Lock car** acts explicitly when the car is unlocked. The padlock icon shows the reported current state; the label describes the action. It does not switch to the requested state before confirmation from the car. Unknown/transitional states disable the control. Code-required locks use Home Assistant's native controls.
- Commands are serialized. Lock feedback stays pending until the requested lock state is reported; an unrelated telemetry update cannot confirm it. Errors and timeouts remain visible. No retries are sent automatically.
- **Climate** opens the supported precondition/stop controls. Other supported remote buttons live under Details. Buttons may legitimately be `unknown` before first use; missing/unavailable buttons are omitted.
- **Details** opens a modal with readings, opening sensors, optional odometer, location more-info and reading timestamps. The card does not expand or move the dashboard. Close it with the close button or Escape; focus returns to Details. Opening a native Home Assistant entity dialog dismisses this modal first. Timestamps describe changes received by Home Assistant, not proof of a live connection. No periodic refresh is forced by the card.

Nothing is sent when the dashboard loads or a detail panel opens. Service acceptance does not prove a button's physical effect; the feedback says “request sent.”

## Development and maintenance

```sh
npm ci
npm run check
python3 -m http.server 8772 --bind 127.0.0.1
# Open /preview/ for synthetic scenarios, sizes and light/dark themes.
```

- `src/vehicle-state.ts`: pure charging/opening interpretation and unit handling.
- `src/commands.ts`: command guards, acknowledgement, lifecycle and feedback.
- `src/volvo-cars-card.ts`: presentation and explicit user interactions.
- `src/editor.ts`, `src/types.ts`: configuration editor and validation.
- `src/styles/card.ts`: responsive layout; `src/shared/` retains Space Hub provenance.

Tests use synthetic states, fake services and a DOM fixture. They never operate a vehicle. The release workflow publishes the tested bundle for an annotated `v*` tag matching `package.json`; generated bundles stay out of the branch.

Production uses HA's `ha-icon`. Preview icon paths are from [Material Design Icons](https://github.com/Templarian/MaterialDesign), Apache-2.0; the generic SVG vehicle is only a local demonstration illustration. No household data or production images belong in the public repository.

## License

MIT; vendored shared files retain their source provenance and notices.

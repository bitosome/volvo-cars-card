import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { Window } from 'happy-dom';

// Exercise the shipping bundle with synthetic cars and mocked HA services only.
const browser = new Window({ url: 'http://volvo-card.test/' });
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'HTMLDialogElement',
  'Element',
  'ShadowRoot',
  'Document',
  'CSSStyleSheet',
  'customElements',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'Node',
  'HTMLInputElement',
  'HTMLSelectElement',
  'KeyboardEvent',
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: key === 'window' ? browser : browser[key],
  });
}
await import('../dist/volvo-cars-card.js');
const entity = (state, attributes = {}) => ({ state, attributes });
const OPENINGS = [
  'door_front_left',
  'door_front_right',
  'door_rear_left',
  'door_rear_right',
  'window_front_left',
  'window_front_right',
  'window_rear_left',
  'window_rear_right',
  'bonnet',
  'sunroof',
  'tailgate',
  'tank_lid',
];
const CONFIG = { type: 'custom:volvo-cars-card', car: 'ex30' };
function states(car = 'ex30', overrides = {}) {
  const base = {
    [`lock.volvo_${car}_lock`]: entity('locked', {
      friendly_name: `Volvo ${car.toUpperCase()} Lock`,
    }),
    [`sensor.volvo_${car}_battery`]: entity('41', { unit_of_measurement: '%' }),
    [`sensor.volvo_${car}_distance_to_empty_battery`]: entity('138', {
      unit_of_measurement: 'km',
    }),
    [`sensor.volvo_${car}_odometer`]: entity('36057', {
      unit_of_measurement: 'km',
    }),
    [`sensor.volvo_${car}_charging_connection_status`]: entity('disconnected'),
    [`sensor.volvo_${car}_charging_status`]: entity('idle'),
    [`sensor.volvo_${car}_charging_power`]: entity('0', {
      unit_of_measurement: 'W',
    }),
    [`sensor.volvo_${car}_charging_power_status`]: entity('no_power_available'),
    [`sensor.volvo_${car}_charging_type`]: entity('none'),
    [`sensor.volvo_${car}_estimated_charging_time`]: entity('0', {
      unit_of_measurement: 'min',
    }),
    [`sensor.volvo_${car}_target_battery_charge_level`]: entity('90', {
      unit_of_measurement: '%',
    }),
    [`device_tracker.volvo_${car}_location`]: entity('not_home', {
      entity_picture: '/api/image/serve/example/original',
    }),
  };
  for (const key of OPENINGS)
    base[`binary_sensor.volvo_${car}_${key}`] = entity('off');
  // HA buttons are unknown until their first press; this is a usable state.
  for (const key of [
    'flash',
    'honk',
    'honk_flash',
    'start_climatisation',
    'stop_climatisation',
  ])
    base[`button.volvo_${car}_${key}`] = entity('unknown');
  return { ...base, ...overrides };
}
async function settle(card) {
  for (let i = 0; i < 6; i++) {
    await card.updateComplete;
    await Promise.resolve();
  }
}
async function fixture({
  config = CONFIG,
  state = states(),
  service,
  services,
  hassUrl = (path) => `https://ha.test${path}`,
} = {}) {
  const calls = [],
    card = document.createElement('volvo-cars-card');
  card.setConfig(config);
  card.hass = {
    states: state,
    services,
    hassUrl,
    callService: async (domain, name, data) => {
      calls.push({ domain, service: name, data: { ...data } });
      return service?.(domain, name, data);
    },
  };
  document.body.append(card);
  await settle(card);
  return { card, calls };
}
const root = (card) => card.shadowRoot;
const text = (node) => node.textContent.replace(/\s+/g, ' ').trim();
const cardText = (card) => text(root(card).querySelector('ha-card'));
const detailsDialog = (card) => root(card).querySelector('.details-dialog');
const dialogText = (card) => text(detailsDialog(card));
const action = (card, name) =>
  name.startsWith("close-") ? root(card).querySelector("dialog .family-icon-button[title=Close]") : root(card).querySelector(`[data-action="${name}"]`);
const charge = (card) => root(card).querySelector('.charging-status');
const openings = (card) => root(card).querySelector('.openings');
const feedback = (card) =>
  root(card).querySelector('ha-card [role="status"], ha-card [role="alert"]');
async function update(card, patch) {
  card.hass = { ...card.hass, states: { ...card.hass.states, ...patch } };
  await settle(card);
}
async function openDetails(card) {
  if (!detailsDialog(card)?.open) {
    action(card, 'disclosure').click();
    await settle(card);
  }
}
afterEach(() => {
  for (const element of [...document.body.children]) element.remove();
});
after(async () => {
  await browser.happyDOM.abort();
  browser.close();
});

test('loading exposes battery, range, charging and openings without sending commands', async () => {
  const { card, calls } = await fixture();
  assert.match(cardText(card), /Volvo EX30/);
  assert.match(
    action(card, 'identity').getAttribute('aria-label'),
    /41 percent/,
  );
  assert.match(cardText(card), /138/);
  assert.match(text(charge(card)), /Unplugged/);
  assert.match(text(openings(card)), /All closed/);
  assert.equal(
    root(card).querySelector('img').getAttribute('src'),
    'https://ha.test/api/image/serve/example/original',
  );
  assert.deepEqual(calls, []);
});
for (const layout of ['banner', 'compact', 'full']) {
  test(`${layout} opens details in a modal without inserting them into the dashboard`, async () => {
    const { card, calls } = await fixture({ config: { ...CONFIG, layout } });
    assert.ok(charge(card));
    assert.ok(openings(card));
    assert.ok(action(card, 'identity'));
    assert.doesNotMatch(cardText(card), /\[object /);
    const overview = root(card).querySelector('ha-card');
    const initialText = cardText(card);
    assert.equal(detailsDialog(card), null);
    assert.equal(
      action(card, 'disclosure').getAttribute('aria-haspopup'),
      'dialog',
    );
    for (let index = 0; index < 2; index++) {
      await openDetails(card);
      assert.equal(detailsDialog(card).open, true);
      assert.ok(detailsDialog(card).querySelector('.details'));
      assert.equal(overview.contains(detailsDialog(card)), false);
      assert.equal(overview.querySelector('.details'), null);
      assert.equal(cardText(card), initialText);
      action(card, 'close-details').click();
      await settle(card);
      assert.equal(detailsDialog(card), null);
      assert.equal(root(card).querySelector('dialog .details'), null);
    }
    assert.deepEqual(calls, []);
  });
}
test('native details cancellation clears its contents and allows reopening', async () => {
  const { card, calls } = await fixture();
  await openDetails(card);
  const dialog = detailsDialog(card);
  // Model the native Escape protocol: cancel, then close unless prevented.
  if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) {
    dialog.close();
  }
  await settle(card);
  assert.equal(dialog.open, false);
  assert.equal(detailsDialog(card), null);
  await openDetails(card);
  assert.equal(detailsDialog(card).open, true);
  assert.ok(detailsDialog(card).querySelector('.details'));
  assert.deepEqual(calls, []);
});
test('details closes on car changes and disconnect, including a pending open', async () => {
  const { card, calls } = await fixture({
    state: { ...states(), ...states('xc40') },
  });
  await openDetails(card);
  card.setConfig({ ...CONFIG, car: 'xc40' });
  await settle(card);
  assert.equal(detailsDialog(card), null);
  assert.equal(root(card).querySelector('dialog .details'), null);

  action(card, 'disclosure').click();
  card.setConfig(CONFIG);
  await settle(card);
  assert.equal(
    detailsDialog(card),
    null,
    'a pending open belongs to the old card configuration',
  );
  await openDetails(card);
  const dialog = detailsDialog(card);
  assert.equal(dialog.open, true);
  card.remove();
  assert.equal(dialog.open, false);
  assert.deepEqual(calls, []);
});
test('an explicit picture wins; missing or failed pictures leave usable controls', async () => {
  const pictured = await fixture({
    config: { ...CONFIG, image: '/local/example-car.png' },
  });
  const image = root(pictured.card).querySelector('img');
  assert.equal(image.src, 'https://ha.test/local/example-car.png');
  image.dispatchEvent(new Event('error'));
  await settle(pictured.card);
  assert.equal(root(pictured.card).querySelector('img'), null);
  assert.ok(action(pictured.card, 'lock'));
  const missing = await fixture({
    state: states('ex30', {
      'device_tracker.volvo_ex30_location': entity('not_home'),
    }),
  });
  assert.equal(root(missing.card).querySelector('img'), null);
  assert.match(cardText(missing.card), /Volvo EX30/);
  assert.deepEqual(pictured.calls, []);
  assert.deepEqual(missing.calls, []);
});
test('framed images fall back once after SVG failure and stale errors cannot affect a new picture', async () => {
  const { card, calls } = await fixture();
  const firstImage = root(card).querySelector('.vehicle-image img');
  const ownerDocument = firstImage.ownerDocument;
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    ownerDocument,
    'createElement',
  );
  const createElement = ownerDocument.createElement;
  let samples = 0;
  Object.defineProperty(ownerDocument, 'createElement', {
    configurable: true,
    value(name, ...args) {
      const element = createElement.call(this, name, ...args);
      if (name === 'canvas') {
        element.getContext = () => ({
          drawImage() {},
          getImageData(_x, _y, width, height) {
            samples++;
            const data = new Uint8ClampedArray(width * height * 4);
            for (let y = height / 4; y < (height * 3) / 4; y++) {
              for (let x = width / 4; x < (width * 3) / 4; x++) {
                data[(y * width + x) * 4 + 3] = 255;
              }
            }
            return { data };
          },
        });
      }
      return element;
    },
  });
  const load = async (image) => {
    Object.defineProperties(image, {
      naturalWidth: { configurable: true, value: 1024 },
      naturalHeight: { configurable: true, value: 512 },
      complete: { configurable: true, value: true },
    });
    image.dispatchEvent(new Event('load'));
    await settle(card);
  };
  try {
    await load(firstImage);
    const firstFrame = root(card).querySelector('.vehicle-image svg');
    assert.ok(firstFrame, 'loaded alpha bounds frame the existing picture');
    const [x, y, width, height] = firstFrame
      .getAttribute('viewBox')
      .split(' ')
      .map(Number);
    assert.ok(x > 0 && y > 0 && width < 1024 && height < 512);
    const firstSvgImage = firstFrame.querySelector('image');
    assert.equal(firstSvgImage.getAttribute('href'), firstImage.src);
    firstSvgImage.dispatchEvent(new Event('error'));
    await settle(card);

    const fallback = root(card).querySelector('.vehicle-image img');
    assert.ok(fallback, 'failed SVG falls back to the ordinary picture');
    assert.equal(fallback.src, firstImage.src);
    await load(fallback);
    await load(fallback);
    assert.equal(root(card).querySelector('.vehicle-image svg'), null);
    assert.equal(samples, 1, 'fallback loads must not restart alpha framing');

    await update(card, {
      'device_tracker.volvo_ex30_location': entity('not_home', {
        entity_picture: '/api/image/serve/updated/original',
      }),
    });
    const nextImage = root(card).querySelector('.vehicle-image img');
    assert.equal(
      nextImage.src,
      'https://ha.test/api/image/serve/updated/original',
    );
    await load(nextImage);
    const nextFrame = root(card).querySelector('.vehicle-image svg');
    assert.ok(nextFrame, 'a new source can be framed after the old fallback');
    assert.equal(samples, 2);

    firstSvgImage.dispatchEvent(new Event('error'));
    firstImage.dispatchEvent(new Event('error'));
    firstImage.dispatchEvent(new Event('load'));
    await settle(card);
    assert.equal(
      root(card).querySelector('.vehicle-image svg'),
      nextFrame,
      'late events from the previous source cannot hide or reset the new frame',
    );
    assert.equal(samples, 2);
    assert.deepEqual(calls, []);
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(ownerDocument, 'createElement', originalDescriptor);
    } else {
      delete ownerDocument.createElement;
    }
  }
});
test('connected with Volvo paused power fault stays neutral, not a charging error', async () => {
  for (const powerStatus of [
    'fault',
    'no_power_available',
    'power_available_but_not_activated',
    'unspecified',
  ]) {
    const { card, calls } = await fixture({
      state: states('ex30', {
        'sensor.volvo_ex30_charging_connection_status': entity('connected'),
        'sensor.volvo_ex30_charging_power_status': entity(powerStatus),
      }),
    });
    assert.match(text(charge(card)), /Connected/);
    assert.equal(charge(card).classList.contains('error'), false, powerStatus);
    assert.doesNotMatch(text(charge(card)), /fault|error|No power/i);
    assert.deepEqual(calls, []);
  }
});
test('charging reports power and remaining time while doors remain independently visible', async () => {
  const { card } = await fixture({
    state: states('ex30', {
      'sensor.volvo_ex30_charging_connection_status': entity('connected'),
      'sensor.volvo_ex30_charging_status': entity('charging'),
      'sensor.volvo_ex30_charging_power': entity('11200', {
        unit_of_measurement: 'W',
      }),
      'sensor.volvo_ex30_estimated_charging_time': entity('121', {
        unit_of_measurement: 'min',
      }),
      'binary_sensor.volvo_ex30_door_front_left': entity('on'),
    }),
  });
  assert.match(text(charge(card)), /Charging/);
  assert.match(text(charge(card)), /11\.2 kW/);
  assert.match(text(charge(card)), /2 h 1 min/);
  assert.match(text(openings(card)), /Front left door/);
  assert.ok(root(card).querySelector('[data-opening="door_front_left"]'));
});
test('explicit charging errors never hide open doors or windows', async () => {
  const { card } = await fixture({
    state: states('ex30', {
      'sensor.volvo_ex30_charging_connection_status': entity('connected'),
      'sensor.volvo_ex30_charging_status': entity('error'),
      'binary_sensor.volvo_ex30_door_front_left': entity('on'),
      'binary_sensor.volvo_ex30_window_rear_right': entity('on'),
    }),
  });
  assert.match(text(charge(card)), /Charging error/);
  assert.equal(charge(card).classList.contains('error'), true);
  const opened = [...root(card).querySelectorAll('[data-opening]')];
  assert.deepEqual(
    opened.map((item) => item.dataset.opening),
    ['door_front_left', 'window_rear_right'],
  );
  const seen = [];
  card.addEventListener('hass-more-info', (event) =>
    seen.push(event.detail.entityId),
  );
  opened[1].click();
  assert.deepEqual(seen, ['binary_sensor.volvo_ex30_window_rear_right']);
});
test('open charge port is expected when plugged in and visible when unplugged', async () => {
  const { card } = await fixture({
    state: states('ex30', {
      'sensor.volvo_ex30_charging_connection_status': entity('connected'),
      'binary_sensor.volvo_ex30_tank_lid': entity('on'),
    }),
  });
  assert.equal(root(card).querySelector('[data-opening="tank_lid"]'), null);
  assert.equal(charge(card).classList.contains('error'), false);
  await update(card, {
    'sensor.volvo_ex30_charging_connection_status': entity('disconnected'),
  });
  assert.match(
    text(root(card).querySelector('[data-opening="tank_lid"]')),
    /Charge port/,
  );
  assert.equal(charge(card).classList.contains('error'), false);
});
test('missing telemetry never claims the battery is empty or all openings are closed', async () => {
  const { card, calls } = await fixture({ state: {} });
  assert.match(
    action(card, 'identity').getAttribute('aria-label'),
    /unavailable/,
  );
  assert.equal(
    root(card).querySelector('[role="meter"]').hasAttribute('aria-valuenow'),
    false,
  );
  assert.match(text(charge(card)), /unavailable/i);
  assert.match(text(openings(card)), /unavailable/i);
  assert.doesNotMatch(text(openings(card)), /All closed/);
  assert.equal(action(card, 'lock').disabled, true);
  action(card, 'lock').click();
  assert.deepEqual(calls, []);
});
test('unlocking requires confirmation and cancellation sends nothing', async () => {
  const { card, calls } = await fixture();
  assert.equal(
    action(card, 'lock').querySelector('ha-icon').icon,
    'mdi:lock-outline',
  );
  assert.equal(text(action(card, 'lock')), 'Unlock');
  action(card, 'lock').click();
  await settle(card);
  assert.equal(root(card).querySelector('.unlock-dialog').open, true);
  assert.deepEqual(calls, []);
  action(card, 'cancel-unlock').click();
  await settle(card);
  assert.equal(root(card).querySelector('.unlock-dialog'), null);
  assert.deepEqual(calls, []);
  action(card, 'lock').click();
  await settle(card);
  const confirm = action(card, 'confirm-unlock');
  assert.equal(confirm.querySelector('ha-icon').icon, 'mdi:lock-outline');
  confirm.click();
  confirm.click();
  await settle(card);
  assert.deepEqual(calls, [
    {
      domain: 'lock',
      service: 'unlock',
      data: { entity_id: 'lock.volvo_ex30_lock' },
    },
  ]);
  assert.match(text(feedback(card)), /Unlocking/);
  assert.equal(action(card, 'lock').disabled, true);
  assert.equal(
    action(card, 'lock').querySelector('ha-icon').icon,
    'mdi:lock-outline',
    'an unlock request does not change the reported locked state',
  );
  action(card, 'lock').click();
  await settle(card);
  assert.equal(
    calls.length,
    1,
    'repeated presses during acknowledgement cannot send another command',
  );
  await update(card, { 'lock.volvo_ex30_lock': entity('unlocked') });
  assert.equal(
    action(card, 'lock').querySelector('ha-icon').icon,
    'mdi:lock-open-variant-outline',
  );
  assert.equal(text(action(card, 'lock')), 'Lock car');
});
test('an unlock confirmation cannot become a lock when telemetry changes', async () => {
  const { card, calls } = await fixture();
  action(card, 'lock').click();
  await settle(card);
  await update(card, { 'lock.volvo_ex30_lock': entity('unlocked') });
  assert.equal(action(card, 'confirm-unlock').disabled, true);
  action(card, 'confirm-unlock').click();
  await settle(card);
  assert.deepEqual(calls, []);
});
test('changing cars invalidates an open confirmation, including the old button handler', async () => {
  const { card, calls } = await fixture({
    state: { ...states(), ...states('xc40') },
  });
  action(card, 'lock').click();
  await settle(card);
  const oldConfirmation = action(card, 'confirm-unlock');
  card.setConfig({ ...CONFIG, car: 'xc40' });
  await settle(card);
  oldConfirmation.click();
  await settle(card);
  assert.deepEqual(calls, []);
  assert.equal(root(card).querySelector('.unlock-dialog'), null);
  action(card, 'lock').click();
  await settle(card);
  action(card, 'confirm-unlock').click();
  await settle(card);
  assert.deepEqual(calls, [
    {
      domain: 'lock',
      service: 'unlock',
      data: { entity_id: 'lock.volvo_xc40_lock' },
    },
  ]);
});
test('locking an unlocked car sends one command and waits for the requested state', async () => {
  const { card, calls } = await fixture({
    state: states('ex30', { 'lock.volvo_ex30_lock': entity('unlocked') }),
  });
  assert.equal(
    action(card, 'lock').querySelector('ha-icon').icon,
    'mdi:lock-open-variant-outline',
  );
  assert.equal(text(action(card, 'lock')), 'Lock car');
  action(card, 'lock').click();
  action(card, 'lock').click();
  await settle(card);
  assert.deepEqual(calls, [
    {
      domain: 'lock',
      service: 'lock',
      data: { entity_id: 'lock.volvo_ex30_lock' },
    },
  ]);
  await update(card, {
    'lock.volvo_ex30_lock': entity('unlocked'),
    'sensor.volvo_ex30_battery': entity('42'),
  });
  assert.equal(
    action(card, 'lock').disabled,
    true,
    'unchanged lock telemetry cannot acknowledge a command',
  );
  assert.match(text(feedback(card)), /Locking/);
  assert.equal(
    action(card, 'lock').querySelector('ha-icon').icon,
    'mdi:lock-open-variant-outline',
  );
  await update(card, { 'lock.volvo_ex30_lock': entity('locked') });
  assert.equal(action(card, 'lock').disabled, false);
  assert.match(text(feedback(card)), /Car locked/);
  assert.equal(
    action(card, 'lock').querySelector('ha-icon').icon,
    'mdi:lock-outline',
  );
});
test('unknown, unavailable, transitional and jammed locks never send commands', async () => {
  for (const state of [
    'unknown',
    'unavailable',
    'locking',
    'unlocking',
    'jammed',
  ]) {
    const { card, calls } = await fixture({
      state: states('ex30', { 'lock.volvo_ex30_lock': entity(state) }),
    });
    assert.equal(action(card, 'lock').disabled, true, state);
    assert.equal(
      action(card, 'lock').querySelector('ha-icon').icon,
      'mdi:lock-alert-outline',
      state,
    );
    action(card, 'lock').click();
    await settle(card);
    assert.deepEqual(calls, []);
  }
});
test('code-protected locks open HA controls instead of bypassing the code', async () => {
  const { card, calls } = await fixture({
    state: states('ex30', {
      'lock.volvo_ex30_lock': entity('locked', { code_format: '^\\d{4}$' }),
    }),
  });
  const seen = [];
  card.addEventListener('hass-more-info', (event) =>
    seen.push(event.detail.entityId),
  );
  action(card, 'lock').click();
  await settle(card);
  assert.deepEqual(seen, ['lock.volvo_ex30_lock']);
  assert.deepEqual(calls, []);
  assert.equal(root(card).querySelector('.unlock-dialog'), null);
});
test('service failures stay visible and accessible with details closed', async () => {
  const { card } = await fixture({
    state: states('ex30', { 'lock.volvo_ex30_lock': entity('unlocked') }),
    service: async () => {
      throw new Error('Vehicle offline');
    },
  });
  action(card, 'lock').click();
  await settle(card);
  assert.equal(root(card).querySelector('.details'), null);
  assert.equal(feedback(card).getAttribute('role'), 'alert');
  assert.match(text(feedback(card)), /Vehicle offline/);
  assert.equal(action(card, 'lock').disabled, false);
  await openDetails(card);
  assert.match(
    text(detailsDialog(card).querySelector('[role="alert"]')),
    /Vehicle offline/,
  );
});
test('missing HA services disable commands even when their entities exist', async () => {
  const { card, calls } = await fixture({ services: {} });
  assert.equal(action(card, 'lock').disabled, true);
  action(card, 'climate').click();
  await settle(card);
  assert.equal(action(card, 'start_climatisation').disabled, true);
  action(card, 'start_climatisation').click();
  assert.deepEqual(calls, []);
});
test('climate opens without acting and shows only available commands', async () => {
  const { card, calls } = await fixture({
    state: states('ex30', {
      'button.volvo_ex30_stop_climatisation': entity('unavailable'),
    }),
  });
  action(card, 'climate').click();
  await settle(card);
  assert.equal(root(card).querySelector('.climate-dialog').open, true);
  assert.deepEqual(calls, []);
  assert.equal(action(card, 'stop_climatisation'), null);
  action(card, 'start_climatisation').click();
  await settle(card);
  assert.deepEqual(calls, [
    {
      domain: 'button',
      service: 'press',
      data: { entity_id: 'button.volvo_ex30_start_climatisation' },
    },
  ]);
  assert.match(
    text(root(card).querySelector('.climate-dialog [role="status"]')),
    /request sent/i,
  );
  assert.doesNotMatch(
    text(feedback(card)),
    /is running|started/i,
    'a service response does not confirm climate operation',
  );
});
test('quick actions are explicit and unavailable actions are omitted', async () => {
  const { card, calls } = await fixture({
    state: states('ex30', { 'button.volvo_ex30_honk': entity('unavailable') }),
  });
  assert.equal(action(card, 'flash'), null);
  await openDetails(card);
  assert.equal(action(card, 'honk'), null);
  action(card, 'flash').click();
  await settle(card);
  assert.deepEqual(calls, [
    {
      domain: 'button',
      service: 'press',
      data: { entity_id: 'button.volvo_ex30_flash' },
    },
  ]);
  assert.match(
    text(detailsDialog(card).querySelector('[role="status"]')),
    /Flash request sent/,
  );
  action(card, 'close-details').click();
  await settle(card);
  assert.equal(root(card).querySelector('.details'), null);
  assert.match(text(feedback(card)), /Flash request sent/);
});
test('empty optional rows hide secondary actions without hiding charging or openings', async () => {
  const { card, calls } = await fixture({ config: { ...CONFIG, show: [] } });
  assert.ok(charge(card));
  assert.ok(openings(card));
  assert.equal(action(card, 'climate'), null);
  await openDetails(card);
  assert.equal(action(card, 'flash'), null);
  assert.doesNotMatch(dialogText(card), /Odometer/);
  assert.deepEqual(calls, []);
});
test('odometer is opt-in and appears only when its sensor is available', async () => {
  const { card } = await fixture({ config: { ...CONFIG, show: ['odometer'] } });
  await openDetails(card);
  assert.match(dialogText(card), /Odometer/);
  assert.match(dialogText(card), /36057 km/);
  await update(card, { 'sensor.volvo_ex30_odometer': entity('unavailable') });
  assert.doesNotMatch(dialogText(card), /Odometer/);
});
test('entity overrides route reads and confirmed commands to the configured car', async () => {
  const { card, calls } = await fixture({
    config: {
      ...CONFIG,
      entities: { lock: 'lock.other_car', battery: 'sensor.other_battery' },
    },
    state: states('ex30', {
      'lock.other_car': entity('locked', { friendly_name: 'Family car Lock' }),
      'sensor.other_battery': entity('73'),
    }),
  });
  assert.match(cardText(card), /Family car/);
  assert.match(
    action(card, 'identity').getAttribute('aria-label'),
    /73 percent/,
  );
  const seen = [];
  card.addEventListener('hass-more-info', (event) =>
    seen.push(event.detail.entityId),
  );
  action(card, 'identity').click();
  assert.deepEqual(seen, ['sensor.other_battery']);
  action(card, 'lock').click();
  await settle(card);
  action(card, 'confirm-unlock').click();
  await settle(card);
  assert.deepEqual(calls, [
    {
      domain: 'lock',
      service: 'unlock',
      data: { entity_id: 'lock.other_car' },
    },
  ]);
});
test('location opens the existing tracker and is omitted when it is missing', async () => {
  const { card, calls } = await fixture();
  await openDetails(card);
  const seen = [];
  card.addEventListener('hass-more-info', (event) => {
    assert.equal(
      detailsDialog(card).open,
      false,
      'the local modal closes before handing off to Home Assistant',
    );
    seen.push(event.detail.entityId);
  });
  assert.ok(action(card, 'location'));
  action(card, 'location').click();
  await settle(card);
  assert.deepEqual(seen, ['device_tracker.volvo_ex30_location']);
  assert.equal(root(card).querySelector('dialog .details'), null);
  assert.deepEqual(calls, []);
  const withoutTracker = states();
  delete withoutTracker['device_tracker.volvo_ex30_location'];
  const missing = await fixture({
    state: withoutTracker,
    config: { ...CONFIG, image: '/local/car.png' },
  });
  await openDetails(missing.card);
  assert.equal(action(missing.card, 'location'), null);
});
test('configuration rejects invalid selectors and keeps legacy layouts valid', () => {
  const card = document.createElement('volvo-cars-card');
  assert.throws(() => card.setConfig({ type: CONFIG.type }), /car/i);
  assert.throws(() => card.setConfig({ ...CONFIG, car: 'EX30' }), /lowercase/);
  assert.throws(
    () => card.setConfig({ ...CONFIG, show: ['doors'] }),
    /Unknown row/,
  );
  assert.throws(
    () =>
      card.setConfig({
        ...CONFIG,
        entities: { boot: 'binary_sensor.example' },
      }),
    /Unknown entity slot/,
  );
  assert.throws(
    () => card.setConfig({ ...CONFIG, entities: { lock: 'nope' } }),
    /entity/i,
  );
  assert.throws(
    () => card.setConfig({ ...CONFIG, layout: 'poster' }),
    /layout/i,
  );
  assert.throws(
    () => card.setConfig({ ...CONFIG, image_size: 'huge' }),
    /image_size/,
  );
  assert.throws(
    () => card.setConfig({ ...CONFIG, image_height: 80.5 }),
    /image_height/,
  );
  for (const layout of ['banner', 'compact', 'full'])
    card.setConfig({ ...CONFIG, layout });
});

test('custom prefixes and opening/action overrides never fall back to another car', async () => {
  const custom = Object.fromEntries(
    Object.entries(states()).map(([id, value]) => [
      id.replace('volvo_ex30_', 'family_ev_'),
      value,
    ]),
  );
  custom['binary_sensor.custom_front_door'] = entity('on');
  custom['button.custom_flash'] = entity('unknown');
  const { card, calls } = await fixture({
    config: {
      type: CONFIG.type,
      prefix: 'family_ev_',
      openings: { door_front_left: 'binary_sensor.custom_front_door' },
      actions: { flash: 'button.custom_flash' },
    },
    state: custom,
  });
  const seen = [];
  card.addEventListener('hass-more-info', (event) =>
    seen.push(event.detail.entityId),
  );
  root(card).querySelector('[data-opening="door_front_left"]').click();
  action(card, 'identity').click();
  assert.deepEqual(seen, [
    'binary_sensor.custom_front_door',
    'sensor.family_ev_battery',
  ]);
  await openDetails(card);
  action(card, 'flash').click();
  await settle(card);
  assert.deepEqual(calls, [
    {
      domain: 'button',
      service: 'press',
      data: { entity_id: 'button.custom_flash' },
    },
  ]);
});

test('charging values retain their units and invalid battery or range values stay unavailable', async () => {
  const { card } = await fixture({
    state: states('ex30', {
      'sensor.volvo_ex30_charging_connection_status': entity('connected'),
      'sensor.volvo_ex30_charging_status': entity('charging'),
      'sensor.volvo_ex30_charging_power': entity('11.2', {
        unit_of_measurement: 'kW',
      }),
      'sensor.volvo_ex30_estimated_charging_time': entity('7200', {
        unit_of_measurement: 's',
      }),
      'sensor.volvo_ex30_battery': entity('101'),
      'sensor.volvo_ex30_distance_to_empty_battery': entity('-1'),
    }),
  });
  assert.match(text(charge(card)), /11\.2 kW/);
  assert.match(text(charge(card)), /2 h/);
  assert.match(
    action(card, 'identity').getAttribute('aria-label'),
    /unavailable/,
  );
  assert.equal(
    root(card).querySelector('[role="meter"]').hasAttribute('aria-valuenow'),
    false,
  );
  assert.doesNotMatch(text(root(card).querySelector('.range-figure')), /-1/);
  await update(card, {
    'sensor.volvo_ex30_battery': entity('   '),
    'sensor.volvo_ex30_distance_to_empty_battery': entity('   '),
  });
  assert.match(
    action(card, 'identity').getAttribute('aria-label'),
    /unavailable/,
  );
  assert.match(text(root(card).querySelector('.range-figure')), /—/);
  assert.equal(
    root(card).querySelector('[role="meter"]').hasAttribute('aria-valuenow'),
    false,
  );
});

test('unlock confirmation uses the shared X without issuing a command and returns focus', async () => {
  const { card, calls } = await fixture();
  const opener = action(card, 'lock');
  opener.click();
  await settle(card);
  const dialog = root(card).querySelector('.unlock-dialog');
  const close = action(card, 'close-unlock');
  assert.equal(dialog.classList.contains('family-dialog'), true);
  assert.equal(close.querySelector('ha-icon').icon, 'mdi:close');
  assert.equal(close.title, 'Close');
  assert.equal(root(card).activeElement, action(card, 'cancel-unlock'));
  close.click();
  await settle(card);
  assert.equal(dialog.open, false);
  assert.equal(root(card).activeElement, opener);
  assert.equal(calls.length, 0);
});

test('details backdrop dismisses only a gesture that starts and ends outside', async () => {
  const { card, calls } = await fixture();
  const opener = action(card, 'disclosure');
  opener.click();
  await settle(card);
  const dialog = detailsDialog(card);
  dialog.getBoundingClientRect = () => ({
    left: 10,
    right: 300,
    top: 10,
    bottom: 400,
  });
  const pointer = (type, x, y) =>
    new browser.PointerEvent(type, { clientX: x, clientY: y, bubbles: true });
  dialog.dispatchEvent(pointer('pointerdown', 40, 40));
  dialog.dispatchEvent(pointer('pointerup', 1, 1));
  assert.equal(dialog.open, true);
  dialog.dispatchEvent(pointer('pointerdown', 1, 1));
  dialog.dispatchEvent(pointer('pointerup', 1, 1));
  await settle(card);
  assert.equal(dialog.open, false);
  assert.equal(root(card).activeElement, opener);
  assert.equal(calls.length, 0);
});

test('modal and direct-action launchers expose their actual interaction type',async()=>{
  const {card,calls}=await fixture();
  for(const selector of ['[data-action="disclosure"]','[data-action="climate"]','[data-action="identity"]','.charging-status','[data-action="lock"]']){
    const button=card.shadowRoot.querySelector(selector);
    assert.equal(button.getAttribute('aria-haspopup'),'dialog');
    assert.equal(button.hasAttribute('aria-expanded'),false);
  }
  card.hass={...card.hass,states:{...card.hass.states,'lock.volvo_ex30_lock':entity('unlocked')}};await settle(card);
  assert.equal(card.shadowRoot.querySelector('[data-action="lock"]').getAttribute('aria-haspopup'),'false');
  assert.equal(calls.length,0);
});

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
const action = (card, name) =>
  root(card).querySelector(`[data-action="${name}"]`);
const charge = (card) => root(card).querySelector('.charging-status');
const openings = (card) => root(card).querySelector('.openings');
const feedback = (card) =>
  root(card).querySelector('ha-card [role="status"], ha-card [role="alert"]');
async function update(card, patch) {
  card.hass = { ...card.hass, states: { ...card.hass.states, ...patch } };
  await settle(card);
}
async function expand(card) {
  if (action(card, 'disclosure').getAttribute('aria-expanded') !== 'true') {
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
  test(`${layout} keeps essential information visible and details disclosure truthful`, async () => {
    const { card, calls } = await fixture({ config: { ...CONFIG, layout } });
    assert.ok(charge(card));
    assert.ok(openings(card));
    assert.ok(action(card, 'identity'));
    assert.doesNotMatch(cardText(card), /\[object /);
    for (let index = 0; index < 3; index++) {
      const expanded =
        action(card, 'disclosure').getAttribute('aria-expanded') === 'true';
      assert.equal(!!root(card).querySelector('.details'), expanded);
      action(card, 'disclosure').click();
      await settle(card);
      assert.equal(!!root(card).querySelector('.details'), !expanded);
    }
    assert.deepEqual(calls, []);
  });
}
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
  action(card, 'lock').click();
  await settle(card);
  assert.equal(root(card).querySelector('.unlock-dialog').open, true);
  assert.deepEqual(calls, []);
  action(card, 'cancel-unlock').click();
  await settle(card);
  assert.equal(root(card).querySelector('.unlock-dialog').open, false);
  assert.deepEqual(calls, []);
  action(card, 'lock').click();
  await settle(card);
  const confirm = action(card, 'confirm-unlock');
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
  assert.equal(root(card).querySelector('.unlock-dialog').open, false);
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
  await update(card, { 'lock.volvo_ex30_lock': entity('locked') });
  assert.equal(action(card, 'lock').disabled, false);
  assert.match(text(feedback(card)), /Car locked/);
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
  assert.equal(root(card).querySelector('.unlock-dialog').open, false);
});
test('service failures stay visible and accessible with details collapsed', async () => {
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
  await expand(card);
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
  action(card, 'disclosure').click();
  await settle(card);
  assert.equal(root(card).querySelector('.details'), null);
  assert.match(text(feedback(card)), /Flash request sent/);
});
test('empty optional rows hide secondary actions without hiding charging or openings', async () => {
  const { card, calls } = await fixture({ config: { ...CONFIG, show: [] } });
  assert.ok(charge(card));
  assert.ok(openings(card));
  assert.equal(action(card, 'climate'), null);
  await expand(card);
  assert.equal(action(card, 'flash'), null);
  assert.doesNotMatch(cardText(card), /Odometer/);
  assert.deepEqual(calls, []);
});
test('odometer is opt-in and appears only when its sensor is available', async () => {
  const { card } = await fixture({ config: { ...CONFIG, show: ['odometer'] } });
  await expand(card);
  assert.match(cardText(card), /Odometer/);
  assert.match(cardText(card), /36057 km/);
  await update(card, { 'sensor.volvo_ex30_odometer': entity('unavailable') });
  assert.doesNotMatch(cardText(card), /Odometer/);
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
  await expand(card);
  const seen = [];
  card.addEventListener('hass-more-info', (event) =>
    seen.push(event.detail.entityId),
  );
  assert.ok(action(card, 'location'));
  action(card, 'location').click();
  assert.deepEqual(seen, ['device_tracker.volvo_ex30_location']);
  assert.deepEqual(calls, []);
  const withoutTracker = states();
  delete withoutTracker['device_tracker.volvo_ex30_location'];
  const missing = await fixture({
    state: withoutTracker,
    config: { ...CONFIG, image: '/local/car.png' },
  });
  await expand(missing.card);
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
  await expand(card);
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
});

import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { Window } from 'happy-dom';

// Exercise the shipping bundle with generic fixtures. No command is ever sent
// by loading the card; every service call below is asserted explicitly.
const browser = new Window({ url: 'http://volvo-card.test/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'ShadowRoot', 'Document', 'CSSStyleSheet', 'customElements', 'Event', 'CustomEvent', 'MutationObserver', 'Node', 'HTMLInputElement', 'HTMLSelectElement', 'KeyboardEvent']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? browser : browser[key] });
}
await import('../dist/volvo-cars-card.js');

const entity = (state, attributes = {}) => ({ state, attributes });
const OPENINGS = ['door_front_left', 'door_front_right', 'door_rear_left', 'door_rear_right',
  'window_front_left', 'window_front_right', 'window_rear_left', 'window_rear_right',
  'bonnet', 'sunroof', 'tailgate', 'tank_lid'];

function states(car = 'ex30', overrides = {}) {
  const base = {
    [`lock.volvo_${car}_lock`]: entity('locked', { friendly_name: `Volvo ${car.toUpperCase()} Lock` }),
    [`sensor.volvo_${car}_battery`]: entity('41', { unit_of_measurement: '%' }),
    [`sensor.volvo_${car}_distance_to_empty_battery`]: entity('138', { unit_of_measurement: 'km' }),
    [`sensor.volvo_${car}_odometer`]: entity('36057', { unit_of_measurement: 'km' }),
    [`sensor.volvo_${car}_charging_connection_status`]: entity('disconnected'),
    [`sensor.volvo_${car}_charging_status`]: entity('idle'),
    [`sensor.volvo_${car}_charging_power`]: entity('0', { unit_of_measurement: 'W' }),
    [`sensor.volvo_${car}_charging_power_status`]: entity('no_power_available'),
    [`sensor.volvo_${car}_charging_type`]: entity('none'),
    [`sensor.volvo_${car}_estimated_charging_time`]: entity('0', { unit_of_measurement: 'min' }),
    [`sensor.volvo_${car}_target_battery_charge_level`]: entity('90', { unit_of_measurement: '%' }),
    [`device_tracker.volvo_${car}_location`]: entity('not_home', { entity_picture: '/api/image/serve/abc/original' }),
  };
  for (const key of OPENINGS) base[`binary_sensor.volvo_${car}_${key}`] = entity('off');
  for (const key of ['flash', 'honk', 'honk_flash', 'start_climatisation', 'stop_climatisation']) {
    base[`button.volvo_${car}_${key}`] = entity('unknown');
  }
  return { ...base, ...overrides };
}

async function settle(card) { for (let index = 0; index < 5; index++) { await card.updateComplete; await Promise.resolve(); } }

async function fixture({ config = { type: 'custom:volvo-cars-card', car: 'ex30' }, state = states(), hassUrl = path => `https://ha.test${path}` } = {}) {
  const calls = [];
  const card = document.createElement('volvo-cars-card');
  card.setConfig(config);
  card.hass = {
    states: state,
    callService: async (domain, service, data) => { calls.push({ domain, service, data }); },
    hassUrl,
  };
  document.body.append(card);
  await settle(card);
  return { card, calls };
}

const root = card => card.shadowRoot;
const text = card => root(card).textContent.replace(/\s+/g, ' ');
const action = (card, name) => root(card).querySelector(`[data-action="${name}"]`);
afterEach(() => { for (const element of [...document.body.children]) element.remove(); });
after(async () => { await browser.happyDOM.abort(); browser.close(); });

test('the hero shows the car, battery, range and its picture without sending anything', async () => {
  const { card, calls } = await fixture();
  assert.match(text(card), /Volvo EX30/);
  assert.match(text(card), /41/);
  assert.match(text(card), /138/);
  const image = root(card).querySelector('img');
  assert.equal(image.getAttribute('src'), 'https://ha.test/api/image/serve/abc/original');
  assert.deepEqual(calls, [], 'loading the card must not send a command');
});

test('without a picture the hero still names the car once', async () => {
  const { card } = await fixture({ state: states('ex30', { 'device_tracker.volvo_ex30_location': entity('not_home') }) });
  assert.equal(root(card).querySelector('img'), null);
  assert.equal((text(card).match(/Volvo EX30/g) ?? []).length, 1);
});

test('an explicit picture URL wins over the tracker picture', async () => {
  const { card } = await fixture({ config: { type: 'custom:volvo-cars-card', car: 'ex30', image: '/local/ex30.png' } });
  assert.equal(root(card).querySelector('img').getAttribute('src'), 'https://ha.test/local/ex30.png');
});

test('the lock action sends one command and shows it as pending', async () => {
  const { card, calls } = await fixture();
  const button = action(card, 'lock');
  assert.match(button.textContent, /Unlock/);
  button.click(); await settle(card);
  assert.deepEqual(calls, [{ domain: 'lock', service: 'unlock', data: { entity_id: 'lock.volvo_ex30_lock' } }]);
  assert.match(text(card), /Unlocking/);
});

test('an unlocked car offers Lock and an unavailable lock refuses to act', async () => {
  const unlocked = await fixture({ state: states('ex30', { 'lock.volvo_ex30_lock': entity('unlocked') }) });
  assert.match(action(unlocked.card, 'lock').textContent, /Lock/);
  action(unlocked.card, 'lock').click(); await settle(unlocked.card);
  assert.equal(unlocked.calls[0].service, 'lock');

  const missing = await fixture({ state: states('ex30', { 'lock.volvo_ex30_lock': entity('unavailable') }) });
  const refused = action(missing.card, 'lock');
  assert.match(refused.textContent, /unavailable/i);
  assert.equal(refused.disabled, true);
  refused.click(); await settle(missing.card);
  assert.deepEqual(missing.calls, []);
});

test('the lock settles once the car reports the state we asked for', async () => {
  const { card } = await fixture();
  action(card, 'lock').click(); await settle(card);
  assert.match(text(card), /Unlocking/);
  card.hass = { ...card.hass, states: { ...card.hass.states, 'lock.volvo_ex30_lock': entity('unlocked') } };
  await settle(card);
  assert.doesNotMatch(text(card), /Unlocking/);
  assert.match(action(card, 'lock').textContent, /Lock/);
});

test('openings stay quiet when everything is closed', async () => {
  const { card } = await fixture();
  assert.match(text(card), /All closed/);
  assert.doesNotMatch(text(card), /Front left door/);
});

test('only the open item is listed, and the charge port says so', async () => {
  const { card } = await fixture({ state: states('ex30', {
    'binary_sensor.volvo_ex30_door_front_left': entity('on'),
    'binary_sensor.volvo_ex30_tank_lid': entity('on'),
  }) });
  assert.doesNotMatch(text(card), /All closed/);
  assert.match(text(card), /Front left door open/);
  assert.match(text(card), /Charge port — charge port open/);
  assert.match(text(card), /2 openings/);
  assert.doesNotMatch(text(card), /Bonnet/);
});

test('charging shows power, time and target while plugged in', async () => {
  const { card } = await fixture({ state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_status': entity('charging'),
    'sensor.volvo_ex30_charging_power': entity('11200', { unit_of_measurement: 'W' }),
    'sensor.volvo_ex30_charging_power_status': entity('charging'),
    'sensor.volvo_ex30_estimated_charging_time': entity('121', { unit_of_measurement: 'min' }),
  }) });
  assert.match(text(card), /Charging/);
  assert.match(text(card), /11\.2 kW/);
  assert.match(text(card), /2 h 1 min to 90%/);
});

test('a charger fault is surfaced as a fault, never as normal charging', async () => {
  const { card } = await fixture({ state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_status': entity('idle'),
    'sensor.volvo_ex30_charging_power_status': entity('fault'),
  }) });
  assert.match(text(card), /Fault/);
  assert.match(text(card), /reported a fault/);
  assert.doesNotMatch(text(card), /Charging\b.*kW/);
});

test('an unplugged car is one quiet line even when it reports no power available', async () => {
  const { card } = await fixture();
  assert.match(text(card), /Not plugged in/);
  assert.match(text(card), /Charges to 90%/);
  assert.doesNotMatch(text(card), /No power available/);
});

test('quick actions appear only when their button entity is usable and send one press', async () => {
  const { card, calls } = await fixture({ state: states('ex30', {
    'button.volvo_ex30_honk': entity('unavailable'),
  }) });
  assert.equal(action(card, 'honk'), null);
  const flash = action(card, 'flash');
  assert.ok(flash);
  flash.click(); await settle(card);
  assert.deepEqual(calls, [{ domain: 'button', service: 'press', data: { entity_id: 'button.volvo_ex30_flash' } }]);
  assert.match(text(card), /Flash sent/);
});

test('the odometer row is opt-in and shows for an available sensor', async () => {
  const hidden = await fixture();
  assert.doesNotMatch(text(hidden.card), /Odometer/);
  const shown = await fixture({ config: { type: 'custom:volvo-cars-card', car: 'ex30', show: ['charging', 'openings', 'odometer'] } });
  assert.match(text(shown.card), /36057 km/);
  assert.match(text(shown.card), /Odometer/);
});

test('tapping a figure opens more-info for that entity', async () => {
  const { card } = await fixture();
  const seen = [];
  card.addEventListener('hass-more-info', event => seen.push(event.detail.entityId));
  root(card).querySelector('[aria-label^="Distance to empty"]').click();
  await settle(card);
  assert.deepEqual(seen, ['sensor.volvo_ex30_distance_to_empty_battery']);
});

test('the xc40 defaults derive every entity from its own prefix', async () => {
  const { card, calls } = await fixture({ config: { type: 'custom:volvo-cars-card', car: 'xc40' }, state: states('xc40') });
  assert.match(text(card), /Volvo XC40/);
  root(card).querySelector('[data-action="lock"]').click(); await settle(card);
  assert.deepEqual((await Promise.resolve(), calls), [{ domain: 'lock', service: 'unlock', data: { entity_id: 'lock.volvo_xc40_lock' } }]);
});

test('configuration is validated when it is set', async () => {
  const card = document.createElement('volvo-cars-card');
  assert.throws(() => card.setConfig({ type: 'custom:volvo-cars-card' }), /car/);
  assert.throws(() => card.setConfig({ type: 'custom:volvo-cars-card', car: 'EX30' }), /lowercase/);
  assert.throws(() => card.setConfig({ type: 'custom:volvo-cars-card', car: 'ex30', show: ['doors'] }), /Unknown row/);
  assert.throws(() => card.setConfig({ type: 'custom:volvo-cars-card', car: 'ex30', entities: { boot: 'binary_sensor.x' } }), /Unknown entity slot/);
  assert.throws(() => card.setConfig({ type: 'custom:volvo-cars-card', car: 'ex30', entities: { lock: 'nope' } }), /Invalid entity/);
  card.setConfig({ type: 'custom:volvo-cars-card', car: 'ex30', entities: { lock: 'lock.other_car' } });
});

test('a car whose entities are absent says so instead of guessing', async () => {
  const { card, calls } = await fixture({ state: {}, config: { type: 'custom:volvo-cars-card', car: 'ex30' } });
  assert.match(text(card), /—/);
  assert.equal(action(card, 'lock').disabled, true);
  action(card, 'lock').click(); await settle(card);
  assert.deepEqual(calls, []);
});

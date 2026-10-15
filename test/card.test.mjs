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

const FULL = { type: 'custom:volvo-cars-card', car: 'ex30', layout: 'full' };
const COMPACT = { type: 'custom:volvo-cars-card', car: 'ex30', layout: 'compact' };
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
  assert.equal(!!root(card).querySelector('img'), false);
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
  const { card } = await fixture({ config: FULL });
  assert.match(text(card), /All closed/);
  assert.doesNotMatch(text(card), /Front left door/);
});

test('only the open item is listed, and the charge port says so', async () => {
  const { card } = await fixture({ config: FULL, state: states('ex30', {
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
  const { card } = await fixture({ config: FULL, state: states('ex30', {
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
  const { card } = await fixture({ config: FULL, state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_status': entity('idle'),
    'sensor.volvo_ex30_charging_power_status': entity('fault'),
  }) });
  assert.match(text(card), /Charging fault/);
  assert.match(text(card), /car reports a charging fault/);
  assert.doesNotMatch(text(card), /Charging\b.*kW/);
});

test('an unplugged car is one quiet line even when it reports no power available', async () => {
  const { card } = await fixture({ config: FULL });
  assert.match(text(card), /Not plugged in/);
  assert.match(text(card), /Charges to 90%/);
  assert.doesNotMatch(text(card), /No power available/);
});

test('quick actions appear only when their button entity is usable and send one press', async () => {
  const { card, calls } = await fixture({ config: FULL, state: states('ex30', {
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
  const shown = await fixture({ config: { type: 'custom:volvo-cars-card', car: 'ex30', layout: 'full', show: ['charging', 'openings', 'odometer'] } });
  assert.match(text(shown.card), /36057 km/);
  assert.match(text(shown.card), /Odometer/);
});

test('tapping a figure opens more-info for that entity', async () => {
  const { card } = await fixture({ config: FULL });
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
  assert.throws(() => card.setConfig({ type: 'custom:volvo-cars-card', car: 'ex30', layout: 'poster' }), /layout must be compact or full/);
  card.setConfig({ type: 'custom:volvo-cars-card', car: 'ex30', entities: { lock: 'lock.other_car' } });
});

test('a car whose entities are absent says so instead of guessing', async () => {
  const { card, calls } = await fixture({ state: {}, config: { type: 'custom:volvo-cars-card', car: 'ex30' } });
  assert.match(text(card), /—/);
  assert.equal(action(card, 'lock').disabled, true);
  action(card, 'lock').click(); await settle(card);
  assert.deepEqual(calls, []);
});

test('the compact layout is a single row with no detail rows until expanded', async () => {
  const { card } = await fixture({ config: COMPACT });
  assert.equal(root(card).querySelectorAll('.compact').length, 1);
  assert.equal(!!root(card).querySelector('.details'), false);
  assert.equal(!!root(card).querySelector('.hero'), false);
  const quiet = text(card);
  for (const gone of ['All closed', 'Quick actions', 'Odometer', 'Not plugged in']) assert.doesNotMatch(quiet, new RegExp(gone));
  const disclosure = action(card, 'disclosure');
  assert.equal(disclosure.getAttribute('aria-expanded'), 'false');
  disclosure.click(); await settle(card);
  assert.equal(action(card, 'disclosure').getAttribute('aria-expanded'), 'true');
  assert.ok(root(card).querySelector('.details'));
  assert.match(text(card), /All closed/);
  assert.match(text(card), /Quick actions/);
  action(card, 'disclosure').click(); await settle(card);
  assert.equal(!!root(card).querySelector('.details'), false);
});

test('chips appear only when they carry information', async () => {
  const normal = await fixture({ config: COMPACT });
  assert.equal(root(normal.card).querySelectorAll('.chip').length, 0, 'a normal car shows no chips');
  assert.equal(!!root(normal.card).querySelector('.alert-line'), false, 'a normal car stays one line');

  const plugged = await fixture({ config: COMPACT, state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
  }) });
  assert.match(root(plugged.card).querySelector('.chip').textContent, /Plugged/);

  const charging = await fixture({ config: COMPACT, state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_status': entity('charging'),
    'sensor.volvo_ex30_charging_power': entity('11200', { unit_of_measurement: 'W' }),
  }) });
  assert.match(root(charging.card).querySelector('.chip').textContent, /11\.2 kW/);

  const open = await fixture({ config: COMPACT, state: states('ex30', {
    'binary_sensor.volvo_ex30_door_front_left': entity('on'),
    'binary_sensor.volvo_ex30_tank_lid': entity('on'),
  }) });
  const chip = root(open.card).querySelector('.chip.warn');
  assert.match(chip.textContent, /2 open/);
});

test('a fault while plugged in is chipped and named once', async () => {
  const { card } = await fixture({ config: COMPACT, state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_power_status': entity('fault'),
  }) });
  assert.match(root(card).querySelector('.chip.alert').textContent, /Charging fault/);
  const lines = root(card).querySelectorAll('.alert-line');
  assert.equal(lines.length, 1, 'at most one extra line');
  assert.match(lines[0].textContent, /The car reports a charging fault/);
});

test('the extra line names what changed instead of listing everything', async () => {
  const { card } = await fixture({ config: COMPACT, state: states('ex30', {
    'binary_sensor.volvo_ex30_door_front_left': entity('on'),
    'binary_sensor.volvo_ex30_window_rear_right': entity('on'),
  }) });
  const line = root(card).querySelector('.alert-line');
  assert.match(line.textContent, /front left door, rear right window open\./);
  assert.doesNotMatch(text(card), /Bonnet|Sunroof|Tailgate/);
});

test('the compact lock pill sends one call, shows pending and refuses when unavailable', async () => {
  const { card, calls } = await fixture({ config: COMPACT });
  const pill = action(card, 'lock');
  assert.equal(pill.getAttribute('aria-label'), 'Unlock');
  pill.click(); await settle(card);
  assert.deepEqual(calls, [{ domain: 'lock', service: 'unlock', data: { entity_id: 'lock.volvo_ex30_lock' } }]);
  assert.equal(action(card, 'lock').getAttribute('aria-label'), 'Unlocking');

  const refused = await fixture({ config: COMPACT, state: states('ex30', { 'lock.volvo_ex30_lock': entity('unavailable') }) });
  assert.equal(action(refused.card, 'lock').disabled, true);
  action(refused.card, 'lock').click(); await settle(refused.card);
  assert.deepEqual(refused.calls, []);
});

test('tapping the identity opens more-info for the battery', async () => {
  const { card } = await fixture();
  const seen = [];
  card.addEventListener('hass-more-info', event => seen.push(event.detail.entityId));
  action(card, 'identity').click(); await settle(card);
  assert.deepEqual(seen, ['sensor.volvo_ex30_battery']);
});

test('layout full still renders the hero structure', async () => {
  const { card } = await fixture({ config: { type: 'custom:volvo-cars-card', car: 'ex30', layout: 'full' } });
  assert.ok(root(card).querySelector('.hero'));
  assert.ok(root(card).querySelector('.figures'));
  assert.equal(!!root(card).querySelector('.compact'), false);
  assert.match(text(card), /All closed/);
});

test('the compact row keeps chips and the single line inside one tile', async () => {
  const { card } = await fixture({ config: COMPACT, state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'binary_sensor.volvo_ex30_door_front_left': entity('on'),
  }) });
  const compact = root(card).querySelector('.compact');
  // plugged in + one opening open + the fixture's no_power_available condition
  assert.equal(compact.querySelectorAll('.chip').length, 3);
  assert.equal(compact.querySelectorAll('.alert-line').length, 1);
  assert.ok(compact.querySelector('[data-action="thumb"]'));
  assert.ok(compact.querySelector('[data-action="lock"]'));
  assert.ok(compact.querySelector('[data-action="disclosure"]'));
  assert.equal(root(card).querySelectorAll('.surface').length, 1, 'still one tile while collapsed');
});

test('neither layout leaks an object into the text', async () => {
  const abnormal = {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_power_status': entity('fault'),
    'binary_sensor.volvo_ex30_tank_lid': entity('on'),
  };
  for (const config of [COMPACT, FULL]) {
    const { card } = await fixture({ config, state: states('ex30', abnormal) });
    assert.doesNotMatch(text(card), /\[object /, `${config.layout ?? 'compact'} layout must not render an object`);
    // Only an abnormal compact row carries the accent glow; the hero has none of its own.
    assert.equal(root(card).querySelectorAll('.glow-overlay').length, config.layout === 'full' ? 0 : 1);
  }
});

test('an open charge port is an opening, never a fault', async () => {
  // Unplugged, port open, and the car reporting no_power_available: that state is not
  // a fault while unplugged, and the port itself must never look like one.
  const { card } = await fixture({ config: COMPACT, state: states('ex30', { 'binary_sensor.volvo_ex30_tank_lid': entity('on') }) });
  const chips = root(card).querySelectorAll('.chip');
  assert.equal(chips.length, 1);
  assert.match(chips[0].textContent, /Charge port open/);
  assert.equal(chips[0].className.trim(), 'chip warn');
  assert.equal(!!root(card).querySelector('.chip.alert'), false, 'no fault chip for an opening');
  // The named chip is the whole indication; a single opening needs no second line.
  assert.equal(!!root(card).querySelector('.alert-line'), false, 'no fault line for an opening');
  assert.equal(root(card).querySelector('.surface.compact').className.trim(), 'surface compact', 'no red surface treatment');
});

test('several openings are named on one amber line', async () => {
  const { card } = await fixture({ config: COMPACT, state: states('ex30', {
    'binary_sensor.volvo_ex30_tank_lid': entity('on'),
    'binary_sensor.volvo_ex30_door_front_left': entity('on'),
  }) });
  assert.match(root(card).querySelector('.chip.warn').textContent, /2 open/);
  const line = root(card).querySelector('.alert-line');
  assert.equal(line.className.trim(), 'alert-line warn');
  assert.match(line.textContent, /front left door, charge port open/);
  assert.equal(!!root(card).querySelector('.chip.alert'), false);
});

test('a car-reported fault with everything closed gets the fault treatment', async () => {
  const { card } = await fixture({ config: COMPACT, state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_power_status': entity('fault'),
  }) });
  assert.match(root(card).querySelector('.chip.alert').textContent, /Charging fault/);
  assert.equal(!!root(card).querySelector('.chip.warn'), false, 'nothing open, so no opening chip');
  assert.equal(root(card).querySelector('.alert-line').className.trim(), 'alert-line alert');
  assert.match(root(card).querySelector('.glow-under').getAttribute('style'), /229,57,53/);
});

test('an open port and a car-reported fault stay two separate signals', async () => {
  const { card } = await fixture({ config: COMPACT, state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_power_status': entity('fault'),
    'binary_sensor.volvo_ex30_door_front_left': entity('on'),
  }) });
  const warn = root(card).querySelector('.chip.warn');
  const alert = root(card).querySelector('.chip.alert');
  assert.match(warn.textContent, /Front left door open/, 'an opening is its own amber signal');
  assert.match(alert.textContent, /Charging fault/, 'the car report is its own red signal');
  const line = root(card).querySelector('.alert-line');
  assert.equal(line.className.trim(), 'alert-line alert');
  assert.match(line.textContent, /The car reports a charging fault/, 'the line never blames the port');
  assert.doesNotMatch(line.textContent, /charge port|tank lid/i);
  assert.equal(root(card).querySelectorAll('.alert-line').length, 1);
});

test('the image size defaults to medium and follows image_size or image_height', async () => {
  const size = async config => root((await fixture({ config: { ...COMPACT, ...config } })).card).querySelector('.thumb').getAttribute('style');
  assert.match(await size({ type: 'custom:volvo-cars-card', car: 'ex30' }), /--thumb-w:128px;--thumb-h:72px/);
  assert.match(await size({ type: 'custom:volvo-cars-card', car: 'ex30', image_size: 'small' }), /--thumb-w:96px;--thumb-h:54px/);
  assert.match(await size({ type: 'custom:volvo-cars-card', car: 'ex30', image_size: 'large' }), /--thumb-w:160px;--thumb-h:90px/);
  assert.match(await size({ type: 'custom:volvo-cars-card', car: 'ex30', image_height: 100 }), /--thumb-w:178px;--thumb-h:100px/);
  const card = document.createElement('volvo-cars-card');
  assert.throws(() => card.setConfig({ type: 'custom:volvo-cars-card', car: 'ex30', image_size: 'huge' }), /image_size must be/);
  assert.throws(() => card.setConfig({ type: 'custom:volvo-cars-card', car: 'ex30', image_height: 5 }), /image_height must be/);
  assert.throws(() => card.setConfig({ type: 'custom:volvo-cars-card', car: 'ex30', image_height: 80.5 }), /image_height must be/);
});

test('a missing supply is amber, not the red fault treatment', async () => {
  const { card } = await fixture({ config: COMPACT, state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_power_status': entity('no_power_available'),
  }) });
  const chip = root(card).querySelector('.chip.warn');
  assert.match(chip.textContent, /No power/);
  assert.equal(!!root(card).querySelector('.chip.alert'), false, 'no_power_available is not a fault');
  assert.match(root(card).querySelector('.alert-line').textContent, /no power available/);
  assert.equal(root(card).querySelector('.alert-line').className.trim(), 'alert-line warn');
});

test('the banner keeps the picture clean and puts the data in one band', async () => {
  const { card } = await fixture();
  const media = root(card).querySelector('.banner-media');
  assert.equal(media.getAttribute('style'), '--banner-h:160px', 'default banner height');
  assert.ok(media.querySelector('img'));
  // Nothing is written on the car: the media holds a picture and a fade, no text.
  assert.equal(media.textContent.trim(), '', 'no text over the picture');
  assert.equal(media.querySelectorAll('button').length, 0, 'no controls over the picture');
  assert.equal(media.querySelectorAll('.band-status').length, 0);
  const band = root(card).querySelector('.banner-band');
  assert.match(band.textContent, /Volvo EX30/);
  assert.match(band.textContent, /41/);
  assert.match(band.textContent, /138/);
  assert.ok(band.querySelector('[data-action="identity"]'));
  assert.ok(band.querySelector('[data-action="lock"]'));
  assert.ok(band.querySelector('[data-action="disclosure"]'));
  assert.equal(!!root(card).querySelector('.details'), false, 'details stay behind the chevron');
  assert.equal(root(card).querySelectorAll('.row').length, 0, 'the banner shows nothing else');
});

test('the band drops the maker eyebrow when the name already says it', async () => {
  const { card } = await fixture();
  assert.equal(root(card).querySelector('.banner-band .eyebrow'), null);
  const named = await fixture({ config: { type: 'custom:volvo-cars-card', car: 'ex30', name: 'The family car' } });
  assert.match(root(named.card).querySelector('.banner-band .eyebrow').textContent, /Volvo/);
});

test('one status phrase, one accent colour, by priority', async () => {
  const phrase = async state => root((await fixture({ state })).card).querySelector('.band-status');
  // quiet: plugged, charging, opening and fault all absent
  const quiet = await phrase(states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_status': entity('charging'),
    'sensor.volvo_ex30_charging_power': entity('11200', { unit_of_measurement: 'W' }),
    'sensor.volvo_ex30_charging_power_status': entity('ok'),
  }));
  assert.match(quiet.textContent, /Charging · 11\.2 kW/);
  assert.equal(quiet.className.trim(), 'band-status quiet');
  // amber: an opening outranks being plugged in
  const opening = await phrase(states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_power_status': entity('ok'),
    'binary_sensor.volvo_ex30_door_front_left': entity('on'),
  }));
  assert.match(opening.textContent, /Front left door open/);
  assert.equal(opening.className.trim(), 'band-status warn');
  // red: the car's fault outranks everything
  const fault = await phrase(states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_power_status': entity('fault'),
    'binary_sensor.volvo_ex30_door_front_left': entity('on'),
  }));
  assert.match(fault.textContent, /Plugged · charging fault/);
  assert.equal(fault.className.trim(), 'band-status alert');
  assert.equal(root((await fixture({ state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_power_status': entity('fault'),
    'binary_sensor.volvo_ex30_door_front_left': entity('on'),
  }) })).card).querySelectorAll('.band-status').length, 1, 'never more than one phrase');
});

test('the banner shows at most one line, and only when it adds something', async () => {
  const lines = async state => root((await fixture({ state })).card).querySelectorAll('.banner-line');
  // a single opening is already the phrase
  assert.equal((await lines(states('ex30', { 'binary_sensor.volvo_ex30_tank_lid': entity('on') }))).length, 0);
  // several openings are named on one line
  const several = await lines(states('ex30', {
    'binary_sensor.volvo_ex30_tank_lid': entity('on'),
    'binary_sensor.volvo_ex30_door_front_left': entity('on'),
  }));
  assert.equal(several.length, 1);
  assert.match(several[0].textContent, /front left door, charge port open/);
  // a car-reported fault keeps its attributed guidance, and still only one line
  const fault = await lines(states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_power_status': entity('fault'),
    'binary_sensor.volvo_ex30_door_front_left': entity('on'),
  }));
  assert.equal(fault.length, 1);
  assert.match(fault[0].textContent, /The car reports a charging fault/);
  assert.equal(fault[0].className.trim(), 'banner-line alert');
});

test('the banner follows image_height and image_size, and shows the details on demand', async () => {
  const height = async config => root((await fixture({ config })).card).querySelector('.banner-media').getAttribute('style');
  assert.equal(await height({ type: 'custom:volvo-cars-card', car: 'ex30', image_height: 240 }), '--banner-h:240px');
  assert.equal(await height({ type: 'custom:volvo-cars-card', car: 'ex30', image_size: 'large' }), '--banner-h:210px');
  assert.equal(await height({ type: 'custom:volvo-cars-card', car: 'ex30', image_size: 'small' }), '--banner-h:130px');
  const { card } = await fixture();
  action(card, 'disclosure').click(); await settle(card);
  assert.ok(root(card).querySelector('.details'));
  assert.match(text(card), /All closed/);
});

test('without a picture the banner is just the band', async () => {
  const { card } = await fixture({ state: states('ex30', { 'device_tracker.volvo_ex30_location': entity('not_home') }) });
  assert.equal(!!root(card).querySelector('.banner-media'), false, 'no empty banner frame');
  const band = root(card).querySelector('.banner-band');
  assert.match(band.textContent, /Volvo EX30/);
  assert.match(band.textContent, /41/);
  assert.ok(band.querySelector('[data-action="lock"]'));
});

test('a connected cable means the charge port is open, so the sensor is not echoed', async () => {
  // The live XC40 case: plugged in while tank_lid still reports closed.
  const { card } = await fixture({ config: COMPACT, state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_type': entity('ac'),
    'sensor.volvo_ex30_charging_power_status': entity('ok'),
    'binary_sensor.volvo_ex30_tank_lid': entity('off'),
  }) });
  assert.equal(!!root(card).querySelector('.chip.warn'), false, 'no port nag while plugged in');
  assert.doesNotMatch(text(card), /charge port open/i);
  action(card, 'disclosure').click(); await settle(card);
  assert.match(text(card), /Charge port sensor reports closed while a cable is connected/);
  assert.doesNotMatch(text(card), /Doors, windows and the charge port are shut/, 'never claims the port is shut');
  const note = [...root(card).querySelectorAll('.row')].find(row => /Charge port sensor/.test(row.textContent));
  const seen = [];
  card.addEventListener('hass-more-info', event => seen.push(event.detail.entityId));
  note.click(); await settle(card);
  assert.deepEqual(seen, ['binary_sensor.volvo_ex30_tank_lid'], 'the port entity is available for more-info');
});

test('a connected cable with the port sensor open is expected, not a nag', async () => {
  const { card } = await fixture({ config: COMPACT, state: states('ex30', {
    'sensor.volvo_ex30_charging_connection_status': entity('connected'),
    'sensor.volvo_ex30_charging_power_status': entity('ok'),
    'binary_sensor.volvo_ex30_tank_lid': entity('on'),
  }) });
  assert.equal(!!root(card).querySelector('.chip.warn'), false);
  assert.doesNotMatch(text(card), /charge port open/i);
  action(card, 'disclosure').click(); await settle(card);
  assert.doesNotMatch(text(card), /Charge port sensor reports/);
  assert.match(text(card), /All closed/);
  assert.match(text(card), /Doors and windows are shut\./);
});

test('an unplugged car still reports an open charge port as an opening', async () => {
  const { card } = await fixture({ config: COMPACT, state: states('ex30', { 'binary_sensor.volvo_ex30_tank_lid': entity('on') }) });
  const chip = root(card).querySelector('.chip.warn');
  assert.match(chip.textContent, /Charge port open/);
  assert.equal(!!root(card).querySelector('.chip.alert'), false);
  action(card, 'disclosure').click(); await settle(card);
  assert.match(text(card), /Charge port — charge port open/);
  assert.doesNotMatch(text(card), /All closed/);
});

test('an unplugged car with everything shut says so, including the port', async () => {
  const { card } = await fixture({ config: COMPACT });
  assert.equal(root(card).querySelectorAll('.chip').length, 0);
  action(card, 'disclosure').click(); await settle(card);
  assert.match(text(card), /All closed/);
  assert.match(text(card), /Doors, windows and the charge port are shut\./);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Exercise the pure TypeScript model without importing the card/browser runtime.
const source = await readFile(
  new URL('../src/vehicle-state.ts', import.meta.url),
  'utf8',
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { deriveCharging, deriveOpenings, numberValue, percentValue } =
  await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  );
const entity = (state, attributes = {}) => ({ state, attributes });
const entities = Object.fromEntries(
  [
    'charging_connection',
    'charging_status',
    'charging_power_status',
    'charging_power',
    'charging_time',
    'charging_target',
    'charging_type',
  ].map((key) => [key, `sensor.example_${key}`]),
);
const openings = [
  'door_front_left',
  'door_front_right',
  'window_front_left',
  'window_front_right',
  'tank_lid',
].map((key) => ({
  key,
  entity: `binary_sensor.example_${key}`,
  label: key.replaceAll('_', ' '),
  icon: 'mdi:car-door',
}));
const car = { entities, openings };
const fixture = (values = {}, openingValues = {}) => ({
  states: {
    ...Object.fromEntries(
      Object.entries({
        charging_connection: 'connected',
        charging_status: 'idle',
        charging_power_status: 'no_power_available',
        charging_type: 'ac',
        ...values,
      }).map(([key, value]) => [
        entities[key],
        typeof value === 'string' ? entity(value) : value,
      ]),
    ),
    ...Object.fromEntries(
      openings.map((item) => [
        item.entity,
        entity(openingValues[item.key] ?? 'off'),
      ]),
    ),
  },
});

test('power fault alone never becomes a car charging error', () => {
  const state = deriveCharging(
    fixture({ charging_power_status: 'fault' }),
    car,
  );
  assert.equal(state.tone, 'neutral');
  assert.equal(state.label, 'Connected · not charging');
  assert.match(state.detail, /paused/);
  assert.equal(
    state.diagnostics.find((item) => item.label === 'Power signal').value,
    'Fault',
  );
});

test('every documented normal power status stays non-alarming', () => {
  for (const power of [
    'initialization',
    'power_available_but_not_activated',
    'providing_power',
    'no_power_available',
  ]) {
    const state = deriveCharging(
      fixture({ charging_power_status: power }),
      car,
    );
    assert.equal(state.tone, 'neutral', power);
    assert.doesNotMatch(state.label, /fault|error/i, power);
  }
});

test('charging status error and connection fault are explicit errors', () => {
  assert.equal(
    deriveCharging(fixture({ charging_status: 'error' }), car).tone,
    'error',
  );
  const connection = deriveCharging(
    fixture({ charging_connection: 'fault' }),
    car,
  );
  assert.equal(connection.connection, 'fault');
  assert.equal(connection.label, 'Connection issue');
  assert.equal(connection.tone, 'error');
});

test('unplugged ignores old power faults, charging errors, power and time', () => {
  const state = deriveCharging(
    fixture({
      charging_connection: 'disconnected',
      charging_power_status: 'fault',
      charging_status: 'error',
      charging_power: '11200',
      charging_time: '90',
    }),
    car,
  );
  assert.equal(state.label, 'Unplugged');
  assert.equal(state.tone, 'neutral');
  assert.equal(state.active, false);
  assert.match(state.detail, /readings disagree/);
  assert.equal(state.power, undefined);
  assert.equal(state.remaining, undefined);
});

test('charging and plug connection must both be reported before showing progress', () => {
  const state = deriveCharging(
    fixture({
      charging_connection: 'unavailable',
      charging_status: 'charging',
      charging_power: '11200',
      charging_time: '90',
    }),
    car,
  );
  assert.equal(state.connection, 'unknown');
  assert.equal(state.active, false);
  assert.match(state.label, /unavailable/);
  assert.equal(state.remaining, undefined);
});

test('normal charging wins over the ambiguous power signal and respects W/kW units', () => {
  for (const power of [
    entity('11200', { unit_of_measurement: 'W' }),
    entity('11.2', { unit_of_measurement: 'kW' }),
  ]) {
    const state = deriveCharging(
      fixture({
        charging_status: 'charging',
        charging_power_status: 'fault',
        charging_power: power,
        charging_time: '90',
        charging_target: '80',
      }),
      car,
    );
    assert.equal(state.active, true);
    assert.equal(state.tone, 'active');
    assert.equal(state.power, '11.2 kW');
    assert.equal(state.remaining, '1 h 30 min');
    assert.equal(state.target, 80);
  }
});

test('charging time rounds carry safely and respects duration units', () => {
  const remaining = (value) =>
    deriveCharging(
      fixture({ charging_status: 'charging', charging_time: value }),
      car,
    ).remaining;
  assert.equal(
    remaining(entity('119.6', { unit_of_measurement: 'min' })),
    '2 h',
  );
  assert.equal(
    remaining(entity('1.5', { unit_of_measurement: 'h' })),
    '1 h 30 min',
  );
  assert.equal(
    remaining(entity('1800', { unit_of_measurement: 's' })),
    '30 min',
  );
  assert.equal(remaining(entity('-1')), undefined);
  assert.equal(remaining(entity('0')), undefined);
});

test('idle, complete and scheduled do not show stale power or remaining time', () => {
  for (const status of ['idle', 'done', 'scheduled', 'discharging']) {
    const state = deriveCharging(
      fixture({
        charging_status: status,
        charging_power: '11200',
        charging_time: '90',
      }),
      car,
    );
    assert.equal(state.active, false, status);
    assert.equal(state.power, undefined, status);
    assert.equal(state.remaining, undefined, status);
  }
});

test('unknown future enums remain diagnostic data, not invented no-power failures', () => {
  const state = deriveCharging(
    fixture({
      charging_status: 'new_state',
      charging_power_status: 'new_power',
    }),
    car,
  );
  assert.equal(state.label, 'Connected');
  assert.equal(state.tone, 'neutral');
  assert.match(state.detail, /New state/);
  assert.doesNotMatch(state.detail, /no power/i);
});

test('the valid none charging type is distinct from unavailable telemetry', () => {
  const type = (value) =>
    deriveCharging(fixture({ charging_type: value }), car).diagnostics.find(
      (item) => item.label === 'Charging type',
    ).value;
  assert.equal(type('none'), 'None');
  assert.equal(type('unknown'), 'Unavailable');
  assert.equal(type('unavailable'), 'Unavailable');
});

test('missing entities remain unavailable instead of unplugged or zero battery', () => {
  const state = deriveCharging(undefined, car);
  assert.equal(state.connection, 'unknown');
  assert.match(state.label, /unavailable/i);
  for (const value of [
    undefined,
    entity(''),
    entity(' '),
    entity('unknown'),
    entity('unavailable'),
    entity('Infinity'),
  ]) {
    assert.equal(numberValue(value), undefined);
  }
  assert.equal(percentValue(entity('0')), 0);
  assert.equal(percentValue(entity('100')), 100);
  assert.equal(percentValue(entity('101')), undefined);
  assert.equal(percentValue(entity('-1')), undefined);
});

test('all openings missing or unknown never becomes all closed', () => {
  assert.equal(deriveOpenings(undefined, car).label, 'Openings unavailable');
  const state = deriveOpenings(
    fixture(
      {},
      Object.fromEntries(openings.map((item) => [item.key, 'unknown'])),
    ),
    car,
  );
  assert.equal(state.label, 'Openings unavailable');
});

test('partial opening telemetry is disclosed even when every known opening is closed', () => {
  const state = deriveOpenings(
    fixture({}, { door_front_left: 'unavailable' }),
    car,
  );
  assert.equal(state.label, 'No openings reported');
  assert.equal(state.unknown.length, 1);
  assert.match(state.detail, /1 sensor is unavailable/);
});

test('open doors and windows remain separate from an expected connected charge port', () => {
  const state = deriveOpenings(
    fixture(
      {},
      { door_front_left: 'on', window_front_right: 'on', tank_lid: 'on' },
    ),
    car,
  );
  assert.deepEqual(
    state.open.map((item) => item.key),
    ['door_front_left', 'window_front_right'],
  );
  assert.equal(state.tone, 'warning');
  assert.equal(state.label, '2 openings');
  assert.equal(state.unknown.length, 0);
});

test('an unplugged car exposes an open charge port while fully known closed sensors are all closed', () => {
  const open = deriveOpenings(
    fixture({ charging_connection: 'disconnected' }, { tank_lid: 'on' }),
    car,
  );
  assert.equal(open.open[0].key, 'tank_lid');
  assert.equal(
    deriveOpenings(fixture({ charging_connection: 'disconnected' }), car).label,
    'All closed',
  );
});

test('absent optional equipment does not create an alert or claim that it was checked', () => {
  const withSunroof = {
    ...car,
    openings: [
      ...openings,
      {
        key: 'sunroof',
        entity: 'binary_sensor.example_sunroof',
        label: 'Sunroof',
        icon: 'mdi:window-open',
      },
    ],
  };
  const state = deriveOpenings(fixture(), withSunroof);
  assert.equal(state.label, 'Doors & windows closed');
  assert.equal(state.unknown.length, 0);
  assert.match(state.detail, /Sunroof is not monitored/);
});

test('a missing tailgate remains unknown even when doors and windows are closed', () => {
  const withTailgate = {
    ...car,
    openings: [
      ...openings,
      {
        key: 'tailgate',
        entity: 'binary_sensor.example_tailgate',
        label: 'Tailgate',
        icon: 'mdi:car-back',
      },
    ],
  };
  const state = deriveOpenings(fixture(), withTailgate);
  assert.equal(state.label, 'No openings reported');
  assert.deepEqual(
    state.unknown.map((item) => item.key),
    ['tailgate'],
  );
});

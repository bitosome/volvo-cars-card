import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

// The controller has no runtime imports: exercise the exact shipping source in
// isolation, with all HA services and timers replaced by deterministic fixtures.
const source = await readFile(
  new URL('../src/commands.ts', import.meta.url),
  'utf8',
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
  },
});
const { VehicleCommands } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

const lock = 'lock.example_car';
const button = 'button.example_car_flash';
const entity = (state, attributes = {}) => ({ state, attributes });
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

function fixture({ service, services } = {}) {
  const calls = [];
  const timers = new Set();
  const moreInfo = [];
  let changes = 0;
  let hass = {
    states: { [lock]: entity('locked'), [button]: entity('unknown') },
    callService: async (domain, name, data) => {
      calls.push({ domain, service: name, data });
      return service?.(domain, name, data);
    },
    ...(services === undefined ? {} : { services }),
  };
  const controller = new VehicleCommands(
    () => hass,
    () => {
      changes++;
    },
    {
      timeoutMs: 1234,
      openMoreInfo: (id) => moreInfo.push(id),
      schedule: (callback, delay) => {
        assert.equal(delay, 1234);
        timers.add(callback);
        return () => timers.delete(callback);
      },
    },
  );
  return {
    controller,
    calls,
    timers,
    moreInfo,
    get hass() {
      return hass;
    },
    set hass(next) {
      hass = next;
    },
    get changes() {
      return changes;
    },
    expire() {
      for (const callback of [...timers]) callback();
    },
  };
}

test('receiving telemetry and creating a controller never sends commands', () => {
  const f = fixture();
  f.controller.update();
  f.hass.states[lock] = entity('unlocked');
  f.controller.update();
  assert.deepEqual(f.calls, []);
});

test('unlock waits for precisely the requested state, ignoring unrelated or transitional updates', async () => {
  const f = fixture();
  await f.controller.lock(lock);
  assert.deepEqual(f.calls, [
    { domain: 'lock', service: 'unlock', data: { entity_id: lock } },
  ]);
  assert.deepEqual(f.controller.pending, {
    entity: lock,
    target: 'unlocked',
    label: 'Unlock',
  });
  for (const state of [
    'locked',
    'unlocking',
    'unknown',
    'unavailable',
    'jammed',
  ]) {
    f.hass.states[lock] = entity(state);
    f.controller.update();
    assert.equal(f.controller.pending?.target, 'unlocked', state);
  }
  f.hass.states[lock] = entity('unlocked');
  f.controller.update();
  assert.equal(f.controller.pending, undefined);
  assert.equal(f.controller.feedback.kind, 'success');
  assert.equal(f.timers.size, 0);
});

test('locking also requires locked, never an unrelated unlocked update', async () => {
  const f = fixture();
  f.hass.states[lock] = entity('unlocked');
  await f.controller.lock(lock);
  assert.equal(f.calls[0].service, 'lock');
  f.controller.update();
  assert.equal(f.controller.pending.target, 'locked');
  f.hass.states[lock] = entity('locked');
  f.controller.update();
  assert.equal(f.controller.feedback.message, 'Car locked.');
});

test('a target update before service acceptance is acknowledged only after acceptance', async () => {
  const response = deferred();
  const f = fixture({ service: () => response.promise });
  const request = f.controller.lock(lock);
  f.hass.states[lock] = entity('unlocked');
  f.controller.update();
  assert.ok(f.controller.pending);
  response.resolve();
  await request;
  assert.equal(f.controller.pending, undefined);
  assert.equal(f.controller.feedback.kind, 'success');
});

test('all command buttons share one in-flight guard', async () => {
  const response = deferred();
  const f = fixture({ service: () => response.promise });
  const request = f.controller.lock(lock);
  await f.controller.lock(lock);
  await f.controller.press(button, 'Flash');
  assert.equal(f.calls.length, 1);
  response.resolve();
  await request;
  await f.controller.press(button, 'Flash');
  assert.equal(f.calls.length, 1, 'still awaiting lock telemetry');
  f.controller.reset();
});

test('unknown button states are allowed and acceptance is not reported as physical success', async () => {
  const f = fixture();
  await f.controller.press(button, 'Flash');
  assert.deepEqual(f.calls, [
    { domain: 'button', service: 'press', data: { entity_id: button } },
  ]);
  assert.equal(f.controller.pending, undefined);
  assert.deepEqual(f.controller.feedback, {
    kind: 'info',
    message: 'Flash request sent.',
  });
});

test('missing, unavailable, wrong-domain and uncertain locks never call services', async () => {
  const f = fixture();
  for (const state of [
    'unknown',
    'unavailable',
    'jammed',
    'locking',
    'unlocking',
    'open',
    '',
  ]) {
    f.hass.states[lock] = entity(state);
    await f.controller.lock(lock);
  }
  delete f.hass.states[lock];
  await f.controller.lock(lock);
  f.hass.states[button] = entity('locked');
  await f.controller.lock(button);
  f.hass.states[button] = entity('unavailable');
  await f.controller.press(button, 'Flash');
  delete f.hass.states[button];
  await f.controller.press(button, 'Flash');
  f.hass.states[lock] = entity('locked');
  await f.controller.press(lock, 'Flash');
  assert.deepEqual(f.calls, []);
  assert.equal(f.controller.feedback.kind, 'error');
});

test('a populated service catalogue must include the action while an omitted one remains compatible', async () => {
  const f = fixture({ services: { lock: { lock: {} } } });
  await f.controller.lock(lock);
  await f.controller.press(button, 'Flash');
  assert.deepEqual(f.calls, []);
  f.hass.services.lock.unlock = {};
  await f.controller.lock(lock);
  assert.equal(f.calls.length, 1);
  f.controller.reset();
  f.hass.services.button = { press: {} };
  await f.controller.press(button, 'Flash');
  assert.equal(f.calls.length, 2);
});

test('code-required locks open native HA controls without sending an incomplete command', async () => {
  const f = fixture();
  for (const attributes of [
    { code_format: '^\\d{4}$' },
    { code_required: true },
  ]) {
    f.hass.states[lock] = entity('locked', attributes);
    await f.controller.lock(lock);
    assert.equal(f.controller.feedback.kind, 'info');
  }
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.moreInfo, [lock, lock]);
});

test('confirmation target cannot reverse after the car state changes', async () => {
  const f = fixture();
  f.hass.states[lock] = entity('unlocked');
  await f.controller.lock(lock, 'unlocked');
  assert.deepEqual(f.calls, []);
  assert.equal(f.controller.feedback.kind, 'info');
  await f.controller.lock(lock, 'locked');
  assert.equal(f.calls[0].service, 'lock');
  f.controller.reset();
});

test('service failures stay visible and never retry', async () => {
  for (const error of [
    new Error('Vehicle rejected request'),
    { message: 'Service unavailable' },
    'Offline',
  ]) {
    const f = fixture({
      service: async () => {
        throw error;
      },
    });
    await f.controller.press(button, 'Flash');
    assert.equal(f.controller.pending, undefined);
    assert.equal(f.controller.feedback.kind, 'error');
    assert.match(f.controller.feedback.message, /Flash failed:/);
    f.controller.update();
    f.expire();
    assert.equal(f.calls.length, 1);
    assert.equal(f.timers.size, 0);
  }
});

test('a rejected lock request cannot be marked successful by telemetry alone', async () => {
  const response = deferred();
  const f = fixture({ service: () => response.promise });
  const request = f.controller.lock(lock);
  f.hass.states[lock] = entity('unlocked');
  f.controller.update();
  response.reject(new Error('Denied'));
  await request;
  assert.equal(f.controller.feedback.kind, 'error');
  f.controller.update();
  assert.equal(f.controller.feedback.kind, 'error');
});

test('timeout clears pending state, remains visible, and a late response cannot overwrite it', async () => {
  const response = deferred();
  const f = fixture({ service: () => response.promise });
  const request = f.controller.press(button, 'Flash');
  f.expire();
  assert.equal(f.controller.pending, undefined);
  assert.equal(f.controller.feedback.kind, 'error');
  const message = f.controller.feedback.message;
  response.resolve();
  await request;
  f.controller.update();
  assert.equal(f.controller.feedback.message, message);
  assert.equal(f.calls.length, 1);
});

test('accepted lock request times out if the requested state never arrives', async () => {
  const f = fixture();
  await f.controller.lock(lock);
  f.expire();
  assert.equal(f.controller.pending, undefined);
  assert.match(f.controller.feedback.message, /did not confirm/);
  f.hass.states[lock] = entity('unlocked');
  f.controller.update();
  assert.equal(f.controller.feedback.kind, 'error');
  assert.equal(f.calls.length, 1);
});

test('reset cancels timers and ignores late replies after changing car or disconnecting', async () => {
  for (const reject of [false, true]) {
    const response = deferred();
    const f = fixture({ service: () => response.promise });
    const request = f.controller.press(button, 'Flash');
    f.controller.reset();
    f.hass = undefined;
    assert.equal(f.timers.size, 0);
    if (reject) response.reject(new Error('Old car response'));
    else response.resolve();
    await request;
    assert.equal(f.controller.feedback, undefined);
    assert.equal(f.controller.pending, undefined);
  }
});

test('a late old response cannot clear another car command', async () => {
  const oldResponse = deferred();
  let count = 0;
  const f = fixture({
    service: () => (++count === 1 ? oldResponse.promise : undefined),
  });
  const oldRequest = f.controller.press(button, 'Flash');
  f.controller.reset();
  const nextLock = 'lock.another_car';
  f.hass.states[nextLock] = entity('locked');
  await f.controller.lock(nextLock);
  oldResponse.reject(new Error('Old response'));
  await oldRequest;
  assert.equal(f.controller.pending.entity, nextLock);
  assert.equal(f.controller.feedback.kind, 'pending');
  f.controller.reset();
});

test('feedback dismissal does not cancel the pending request', async () => {
  const f = fixture();
  await f.controller.lock(lock);
  f.controller.clearFeedback();
  assert.equal(f.controller.feedback, undefined);
  assert.ok(f.controller.pending);
  f.hass.states[lock] = entity('unlocked');
  f.controller.update();
  assert.equal(f.controller.feedback.kind, 'success');
});

import type { EntityState, Hass, ResolvedCar } from './types';

export type SignalTone = 'neutral' | 'active' | 'warning' | 'error';
export type Diagnostic = { entity: string; label: string; value: string };
export type ChargingState = {
  connection: 'connected' | 'disconnected' | 'fault' | 'unknown';
  active: boolean;
  label: string;
  tone: SignalTone;
  detail: string;
  power?: string;
  remaining?: string;
  target?: number;
  diagnostics: Diagnostic[];
};
export type OpeningItem = ResolvedCar['openings'][number] & { state?: string };
export type OpeningsState = {
  open: OpeningItem[];
  unknown: OpeningItem[];
  label: string;
  detail: string;
  tone: SignalTone;
};

const UNAVAILABLE = new Set(['', 'unknown', 'unavailable', 'none', 'null']);
const stateOf = (entity?: EntityState) =>
  String(entity?.state ?? '')
    .trim()
    .toLowerCase();
const readable = (value: string) =>
  value.replaceAll('_', ' ').replace(/^./, (first) => first.toUpperCase());

/** Do not turn empty telemetry into zero, or invalid percentages into healthy data. */
export function numberValue(entity?: EntityState): number | undefined {
  const raw = stateOf(entity);
  if (UNAVAILABLE.has(raw)) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function percentValue(entity?: EntityState): number | undefined {
  const value = numberValue(entity);
  return value !== undefined && value >= 0 && value <= 100 ? value : undefined;
}

function powerText(entity?: EntityState): string | undefined {
  const value = numberValue(entity);
  if (value === undefined || value < 0) return undefined;
  const unit = String(entity?.attributes.unit_of_measurement ?? 'W')
    .trim()
    .toLowerCase();
  if (!['w', 'kw'].includes(unit)) return undefined;
  const kw = unit === 'kw' ? value : value / 1000;
  return `${Number(kw.toFixed(kw >= 100 ? 0 : 1))} kW`;
}

function timeText(entity?: EntityState): string | undefined {
  const value = numberValue(entity);
  if (value === undefined || value <= 0) return undefined;
  const unit = String(entity?.attributes.unit_of_measurement ?? 'min')
    .trim()
    .toLowerCase();
  let minutes: number;
  if (['min', 'minute', 'minutes'].includes(unit)) minutes = value;
  else if (['h', 'hr', 'hour', 'hours'].includes(unit)) minutes = value * 60;
  else if (['s', 'sec', 'second', 'seconds'].includes(unit))
    minutes = value / 60;
  else return undefined;
  // Round before splitting so 119.6 minutes becomes 2 h, never 1 h 60 min.
  minutes = Math.max(1, Math.round(minutes));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours
    ? `${hours} h${remainder ? ` ${remainder} min` : ''}`
    : `${minutes} min`;
}

/**
 * The Volvo power-status "fault" is ambiguous: HA documents it for a charger that
 * is paused. Only the connection/status error signals establish a charging error.
 * Keep raw diagnostics available, but never turn a normal power enum into a fault.
 * https://www.home-assistant.io/integrations/volvo/#troubleshooting
 */
export function deriveCharging(
  hass: Hass | undefined,
  car: ResolvedCar,
): ChargingState {
  const entity = (id: string) => hass?.states[id];
  const slots = car.entities;
  const rawConnection = stateOf(entity(slots.charging_connection));
  const connection = ['connected', 'disconnected', 'fault'].includes(
    rawConnection,
  )
    ? (rawConnection as ChargingState['connection'])
    : 'unknown';
  const status = stateOf(entity(slots.charging_status));
  const powerStatus = stateOf(entity(slots.charging_power_status));
  const target = percentValue(entity(slots.charging_target));
  const diagnostics: Diagnostic[] = [
    {
      entity: slots.charging_connection,
      label: 'Plug connection',
      value: rawConnection,
    },
    { entity: slots.charging_status, label: 'Charging state', value: status },
    {
      entity: slots.charging_power_status,
      label: 'Power signal',
      value: powerStatus,
    },
    {
      entity: slots.charging_type,
      label: 'Charging type',
      value: stateOf(entity(slots.charging_type)),
    },
  ].map((item) => ({
    ...item,
    value:
      item.entity === slots.charging_type && item.value === 'none'
        ? 'None'
        : UNAVAILABLE.has(item.value)
          ? 'Unavailable'
          : readable(item.value),
  }));
  const base = {
    connection,
    active: false,
    tone: 'neutral' as SignalTone,
    target,
    diagnostics,
  };

  if (connection === 'fault') {
    return {
      ...base,
      tone: 'error',
      label: 'Connection issue',
      detail: 'The car reports a charging connection fault.',
    };
  }
  // A disconnected cable makes old power/time/status telemetry irrelevant.
  if (connection === 'disconnected') {
    return {
      ...base,
      label: 'Unplugged',
      detail:
        status === 'error'
          ? 'The cable is disconnected. A charging error is also reported; these readings disagree.'
          : 'The charging cable is disconnected.',
    };
  }
  if (status === 'error') {
    return {
      ...base,
      tone: 'error',
      label: 'Charging error',
      detail:
        'The car reports a charging error. Check the car or charger for details.',
    };
  }
  if (connection === 'unknown') {
    return {
      ...base,
      label: 'Plug status unavailable',
      detail: 'The charging connection cannot be confirmed.',
    };
  }
  if (status === 'charging') {
    return {
      ...base,
      active: true,
      tone: 'active',
      label: 'Charging',
      detail: 'The car reports that charging is in progress.',
      power: powerText(entity(slots.charging_power)),
      remaining: timeText(entity(slots.charging_time)),
    };
  }
  if (status === 'done' || status === 'complete') {
    return {
      ...base,
      label: 'Charge complete',
      detail: 'Charging has finished; the cable is still connected.',
    };
  }
  if (status === 'scheduled' || status === 'smart_charging') {
    return {
      ...base,
      label: 'Scheduled',
      detail: 'The car is waiting for its charging schedule.',
    };
  }
  if (status === 'discharging') {
    return {
      ...base,
      label: 'Discharging',
      detail: 'The car reports energy leaving the battery.',
    };
  }
  if (powerStatus === 'initialization') {
    return {
      ...base,
      label: 'Preparing to charge',
      detail: 'The charger connection is initializing.',
    };
  }
  if (status === 'idle' && powerStatus === 'fault') {
    return {
      ...base,
      label: 'Connected · not charging',
      detail:
        'The car is not charging. Volvo’s power signal can also report “fault” when the charger is paused.',
    };
  }
  if (status === 'idle') {
    return {
      ...base,
      label: 'Connected · not charging',
      detail:
        powerStatus === 'no_power_available'
          ? 'The cable is connected; the charger is not supplying power.'
          : powerStatus === 'power_available_but_not_activated'
            ? 'Power is available, but charging has not started.'
            : 'The cable is connected; charging has not started.',
    };
  }
  return {
    ...base,
    label: 'Connected',
    detail: UNAVAILABLE.has(status)
      ? 'The cable is connected; the charging state is unavailable.'
      : `The car reports: ${readable(status)}.`,
  };
}

/**
 * Unsupported/missing sensors and unavailable telemetry must not become "closed".
 * An open charge port is expected with a connected cable and is excluded from the
 * alert list; doors, windows and other openings remain visible independently.
 */
export function deriveOpenings(
  hass: Hass | undefined,
  car: ResolvedCar,
): OpeningsState {
  const connected =
    stateOf(hass?.states[car.entities.charging_connection]) === 'connected';
  const relevant = car.openings.filter(
    (item) => !(connected && item.key === 'tank_lid'),
  );
  const required = (key: string) =>
    key.startsWith('door_') || key.startsWith('window_') || key === 'tailgate';
  const missingOptional = relevant.filter(
    (item) => !required(item.key) && !hass?.states[item.entity],
  );
  const items: OpeningItem[] = relevant
    .filter((item) => required(item.key) || !!hass?.states[item.entity])
    .map((item) => ({ ...item, state: stateOf(hass?.states[item.entity]) }));
  const open = items.filter(
    (item) => item.state === 'on' || item.state === 'open',
  );
  const unknown = items.filter(
    (item) => !['on', 'off', 'open', 'closed'].includes(item.state ?? ''),
  );
  const unknownNote = unknown.length
    ? `${unknown.length} ${unknown.length === 1 ? 'sensor is' : 'sensors are'} unavailable.`
    : '';
  if (open.length) {
    return {
      open,
      unknown,
      tone: 'warning',
      label:
        open.length === 1 ? `${open[0].label} open` : `${open.length} openings`,
      detail: [open.map((item) => item.label).join(', '), unknownNote]
        .filter(Boolean)
        .join('. '),
    };
  }
  if (!items.length || unknown.length === items.length) {
    return {
      open,
      unknown,
      tone: 'neutral',
      label: 'Openings unavailable',
      detail: 'Door and window states cannot be confirmed.',
    };
  }
  if (unknown.length) {
    return {
      open,
      unknown,
      tone: 'neutral',
      label: 'No openings reported',
      detail: `${unknownNote} The remaining sensors report closed.`,
    };
  }
  return {
    open,
    unknown,
    tone: 'neutral',
    label: missingOptional.length ? 'Doors & windows closed' : 'All closed',
    detail: missingOptional.length
      ? `Doors, windows and the tailgate report closed. ${missingOptional.map((item) => item.label).join(', ')} ${missingOptional.length === 1 ? 'is' : 'are'} not monitored.`
      : connected
        ? 'Doors, windows and luggage compartments are closed.'
        : 'Doors, windows, luggage compartments and the charge port are closed.',
  };
}

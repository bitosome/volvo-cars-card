export interface EntityState {
  state: string;
  attributes: Record<string, any>;
  last_changed?: string;
  last_updated?: string;
}
export interface Hass {
  locale?: { language?: string };
  config?: { time_zone?: string };
  hassUrl?(path: string): string;
  states: Record<string, EntityState>;
  services?: Record<string, Record<string, unknown>>;
  callService(
    domain: string,
    service: string,
    data: Record<string, unknown>,
  ): Promise<unknown>;
}

/** Rows the card can show, in the order they are rendered. */
export const ROWS = ['charging', 'openings', 'actions', 'odometer'] as const;
export type Row = (typeof ROWS)[number];

/** Entity slots derived from the car prefix, each overridable in the config. */
export const SLOTS = [
  'lock',
  'battery',
  'range',
  'odometer',
  'charging_connection',
  'charging_status',
  'charging_power',
  'charging_power_status',
  'charging_type',
  'charging_time',
  'charging_target',
] as const;
export type Slot = (typeof SLOTS)[number];

/** Body openings, in the order they are listed when open. */
export const OPENINGS = [
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
] as const;
export type Opening = (typeof OPENINGS)[number];

/** Momentary actions, in the order they are offered. */
export const ACTIONS = [
  'flash',
  'honk',
  'honk_flash',
  'start_climatisation',
  'stop_climatisation',
] as const;
export type Action = (typeof ACTIONS)[number];

export const LAYOUTS = ['banner', 'compact', 'full'] as const;
export type Layout = (typeof LAYOUTS)[number];

export const IMAGE_SIZES = ['small', 'medium', 'large'] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];
/** Thumbnail heights; the width follows the cars' 16:9 pictures. */
export const IMAGE_HEIGHTS: Record<ImageSize, number> = {
  small: 54,
  medium: 72,
  large: 90,
};
/** Banner heights for the same presets: the picture leads, so the scale is larger. */
export const BANNER_HEIGHTS: Record<ImageSize, number> = {
  small: 130,
  medium: 160,
  large: 210,
};
export const ASPECT = 16 / 9;

export function imageSize(height: number): { width: number; height: number } {
  return { width: Math.round(height * ASPECT), height };
}

export interface VolvoCardConfig {
  type: string;
  /** `banner` (default) leads with the picture, `compact` is one dense row, `full` is the hero. */
  layout?: Layout;
  /** Car key used to derive every entity id, e.g. `ex30` for `volvo_ex30_*`. */
  car?: string;
  /** Explicit entity prefix, e.g. `volvo_ex30_`, for a car key that does not fit. */
  prefix?: string;
  name?: string;
  /** Picture URL. Defaults to the picture of `image_entity`, then the car's tracker. */
  image?: string;
  image_entity?: string;
  /** Picture size preset. Compact: 96x54 / 128x72 / 160x90. Banner: 130 / 160 / 210 tall. */
  image_size?: ImageSize;
  /** Explicit picture height in pixels, overriding `image_size`. */
  image_height?: number;
  /** Per-slot entity overrides for anything that is not named the standard way. */
  entities?: Partial<Record<Slot, string>>;
  /** Overrides for renamed body sensors and remote buttons. */
  openings?: Partial<Record<Opening, string>>;
  actions?: Partial<Record<Action, string>>;
  /** Extra entities shown as quiet secondary rows. */
  show?: Row[];
}

export interface ResolvedCar {
  layout: Layout;
  thumb: { width: number; height: number };
  bannerHeight: number;
  name: string;
  prefix: string;
  image?: string;
  imageEntity?: string;
  entities: Record<Slot, string>;
  openings: Array<{
    entity: string;
    key: Opening;
    label: string;
    icon: string;
  }>;
  actions: Array<{ entity: string; key: Action; label: string; icon: string }>;
  show: Row[];
}

export const OPENING_LABELS: Record<Opening, string> = {
  door_front_left: 'Front left door',
  door_front_right: 'Front right door',
  door_rear_left: 'Rear left door',
  door_rear_right: 'Rear right door',
  window_front_left: 'Front left window',
  window_front_right: 'Front right window',
  window_rear_left: 'Rear left window',
  window_rear_right: 'Rear right window',
  bonnet: 'Bonnet',
  sunroof: 'Sunroof',
  tailgate: 'Tailgate',
  // On these cars the tank lid is the charging port cover.
  tank_lid: 'Charge port',
};
export const OPENING_ICONS: Record<Opening, string> = {
  door_front_left: 'mdi:car-door',
  door_front_right: 'mdi:car-door',
  door_rear_left: 'mdi:car-door',
  door_rear_right: 'mdi:car-door',
  window_front_left: 'mdi:window-closed',
  window_front_right: 'mdi:window-closed',
  window_rear_left: 'mdi:window-closed',
  window_rear_right: 'mdi:window-closed',
  bonnet: 'mdi:engine',
  sunroof: 'mdi:window-open',
  tailgate: 'mdi:car-back',
  tank_lid: 'mdi:ev-station',
};
export const ACTION_LABELS: Record<Action, string> = {
  flash: 'Flash',
  honk: 'Honk',
  honk_flash: 'Honk & flash',
  start_climatisation: 'Precondition',
  stop_climatisation: 'Stop precondition',
};
export const ACTION_ICONS: Record<Action, string> = {
  flash: 'mdi:lightbulb-on-outline',
  honk: 'mdi:bullhorn-outline',
  honk_flash: 'mdi:bullhorn',
  start_climatisation: 'mdi:snowflake',
  stop_climatisation: 'mdi:snowflake-off',
};

const SLOT_PATHS: Record<Slot, string> = {
  lock: 'lock',
  battery: 'battery',
  range: 'distance_to_empty_battery',
  odometer: 'odometer',
  charging_connection: 'charging_connection_status',
  charging_status: 'charging_status',
  charging_power: 'charging_power',
  charging_power_status: 'charging_power_status',
  charging_type: 'charging_type',
  charging_time: 'estimated_charging_time',
  charging_target: 'target_battery_charge_level',
};
const ID = /^[a-z_]+\.[a-z0-9_]+$/;

/** Volvo entity ids follow the integration's naming, so the car key is enough. */
export function entityPrefix(config: VolvoCardConfig): string {
  if (config.prefix) return config.prefix;
  if (!config.car)
    throw new Error('Choose the car (car: ex30) or set an entity prefix.');
  return `volvo_${config.car}_`;
}

export function resolveCar(config: VolvoCardConfig, hass?: Hass): ResolvedCar {
  const prefix = entityPrefix(config);
  const entities = {} as Record<Slot, string>;
  for (const slot of SLOTS) {
    const domain = slot === 'lock' ? 'lock' : 'sensor';
    entities[slot] =
      config.entities?.[slot] ?? `${domain}.${prefix}${SLOT_PATHS[slot]}`;
  }
  const imageEntity = config.image_entity ?? `device_tracker.${prefix}location`;
  const tracked = hass?.states[imageEntity]?.attributes?.entity_picture;
  const named = hass?.states[entities.lock]?.attributes?.friendly_name;
  const openings = OPENINGS.map((key) => ({
    entity: config.openings?.[key] ?? `binary_sensor.${prefix}${key}`,
    key,
    label: OPENING_LABELS[key],
    icon: OPENING_ICONS[key],
  }));
  const actions = ACTIONS.map((key) => ({
    entity: config.actions?.[key] ?? `button.${prefix}${key}`,
    key,
    label: ACTION_LABELS[key],
    icon: ACTION_ICONS[key],
  }));
  return {
    prefix,
    layout: config.layout ?? 'banner',
    thumb: imageSize(
      config.image_height ?? IMAGE_HEIGHTS[config.image_size ?? 'medium'],
    ),
    bannerHeight:
      config.image_height ?? BANNER_HEIGHTS[config.image_size ?? 'medium'],
    name:
      config.name ||
      stripCarName(named) ||
      `Volvo ${String(config.car ?? '').toUpperCase()}`.trim(),
    image: config.image || (typeof tracked === 'string' ? tracked : undefined),
    imageEntity,
    entities,
    openings,
    actions,
    show: config.show ? [...config.show] : ['charging', 'openings', 'actions'],
  };
}

function stripCarName(friendly?: string): string | undefined {
  if (typeof friendly !== 'string') return undefined;
  return friendly.replace(/\s+lock$/i, '').trim() || undefined;
}

export function validateConfig(raw: VolvoCardConfig): VolvoCardConfig {
  if (!raw || typeof raw !== 'object')
    throw new Error('Card configuration is missing.');
  if (!raw.car && !raw.prefix)
    throw new Error('Set the car (car: ex30 or car: xc40).');
  if (raw.car !== undefined && !/^[a-z0-9_]+$/.test(raw.car))
    throw new Error('car must be a lowercase key such as ex30.');
  if (raw.prefix !== undefined && !/^[a-z0-9_]+_$/.test(raw.prefix))
    throw new Error('prefix must look like volvo_ex30_.');
  if (
    raw.image_size !== undefined &&
    !(IMAGE_SIZES as readonly string[]).includes(raw.image_size)
  )
    throw new Error('image_size must be small, medium or large.');
  if (raw.image_height !== undefined) {
    if (
      !Number.isInteger(raw.image_height) ||
      raw.image_height < 32 ||
      raw.image_height > 260
    )
      throw new Error(
        'image_height must be a whole number of pixels between 32 and 260.',
      );
  }
  for (const key of ['name', 'image', 'image_entity'] as const) {
    if (
      raw[key] !== undefined &&
      (typeof raw[key] !== 'string' || !raw[key]!.trim())
    )
      throw new Error(`${key} must be a non-empty string.`);
  }
  if (raw.image_entity && !ID.test(raw.image_entity))
    throw new Error('image_entity must be an entity id.');
  if (raw.entities !== undefined) {
    if (
      typeof raw.entities !== 'object' ||
      raw.entities === null ||
      Array.isArray(raw.entities)
    )
      throw new Error('entities must be an object of slot overrides.');
    for (const [slot, entity] of Object.entries(raw.entities)) {
      if (!(SLOTS as readonly string[]).includes(slot))
        throw new Error(`Unknown entity slot ${slot}.`);
      if (
        typeof entity !== 'string' ||
        !ID.test(entity) ||
        !entity.startsWith(slot === 'lock' ? 'lock.' : 'sensor.')
      )
        throw new Error(`Invalid entity for ${slot}.`);
    }
  }
  for (const [field, keys, domain] of [
    ['openings', OPENINGS, 'binary_sensor.'],
    ['actions', ACTIONS, 'button.'],
  ] as const) {
    const overrides = raw[field];
    if (overrides === undefined) continue;
    if (
      typeof overrides !== 'object' ||
      overrides === null ||
      Array.isArray(overrides)
    )
      throw new Error(`${field} must be an object of entity overrides.`);
    for (const [key, value] of Object.entries(overrides)) {
      if (
        !(keys as readonly string[]).includes(key) ||
        typeof value !== 'string' ||
        !ID.test(value) ||
        !value.startsWith(domain)
      )
        throw new Error(`Invalid ${field} entity for ${key}.`);
    }
  }
  if (
    raw.layout !== undefined &&
    !(LAYOUTS as readonly string[]).includes(raw.layout)
  )
    throw new Error('layout must be banner, compact or full.');
  if (raw.show !== undefined) {
    if (!Array.isArray(raw.show))
      throw new Error('show must be a list of rows.');
    for (const row of raw.show)
      if (!(ROWS as readonly string[]).includes(row))
        throw new Error(`Unknown row ${row}.`);
  }
  // Validate the derived ids too, so a bad car key fails at config time.
  entityPrefix(raw);
  return {
    ...raw,
    openings: raw.openings ? { ...raw.openings } : undefined,
    actions: raw.actions ? { ...raw.actions } : undefined,
    car: raw.car,
    show: raw.show ? [...raw.show] : undefined,
    entities: raw.entities ? { ...raw.entities } : undefined,
  };
}

export const BAD = new Set(['unknown', 'unavailable', 'none', '']);
export function available(entity?: EntityState): boolean {
  return !!entity && !BAD.has(entity.state);
}
export function numeric(entity?: EntityState): number | undefined {
  if (!available(entity)) return undefined;
  const value = Number(entity!.state);
  return Number.isFinite(value) ? value : undefined;
}
export function humanize(value: unknown): string {
  return String(value ?? '')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}
export function hassUrl(hass: Hass | undefined, path: string): string {
  if (!path) return path;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  return hass?.hassUrl?.(path) ?? path;
}
export function pressable(entity?: EntityState): boolean {
  return !!entity && entity.state !== 'unavailable';
}

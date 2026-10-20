import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  ROWS,
  SLOTS,
  OPENINGS,
  OPENING_LABELS,
  ACTIONS,
  ACTION_LABELS,
  LAYOUTS,
  IMAGE_SIZES,
  resolveCar,
  type Hass,
  type Row,
  type Slot,
  type VolvoCardConfig,
} from './types';

const ROW_LABELS: Record<Row, string> = {
  charging: 'Charging',
  openings: 'Openings',
  actions: 'Quick actions',
  odometer: 'Odometer',
};
const SLOT_LABELS: Record<Slot, string> = {
  lock: 'Lock',
  battery: 'Battery',
  range: 'Distance to empty',
  odometer: 'Odometer',
  charging_connection: 'Charging connection',
  charging_status: 'Charging status',
  charging_power: 'Charging power',
  charging_power_status: 'Charging power status',
  charging_type: 'Charging type',
  charging_time: 'Estimated charging time',
  charging_target: 'Target charge level',
};

@customElement('volvo-cars-card-editor')
export class VolvoCarsCardEditor extends LitElement {
  @property({ attribute: false }) hass?: Hass;
  @state() private config?: VolvoCardConfig;
  static styles = css`
    :host {
      display: block;
      color: var(--primary-text-color);
      font-family: inherit;
    }
    * {
      box-sizing: border-box;
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      margin: 12px 0;
    }
    input,
    select,
    button {
      font: inherit;
      color: inherit;
      min-height: 44px;
      border: 1px solid var(--divider-color, #777);
      border-radius: 10px;
      padding: 10px;
      background: var(--card-background-color, #fff);
    }
    input:focus-visible,
    select:focus-visible,
    button:focus-visible,
    summary:focus-visible {
      outline: 2px solid var(--primary-color);
      outline-offset: 2px;
    }
    h3 {
      font-size: 15px;
      margin: 20px 0 8px;
    }
    p {
      color: var(--secondary-text-color);
      font-size: 12px;
      line-height: 1.5;
    }
    details {
      margin-top: 16px;
    }
    summary {
      cursor: pointer;
      min-height: 44px;
      padding: 12px 0;
    }
    .rows {
      display: grid;
      gap: 8px;
    }
    .rows label {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
    }
    .rows input {
      width: 20px;
      min-height: 20px;
    }
  `;

  setConfig(config: VolvoCardConfig) {
    this.config = {
      ...config,
      entities: config.entities ? { ...config.entities } : undefined,
      show: config.show ? [...config.show] : undefined,
    };
  }

  private emit() {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: this.config },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private set(key: keyof VolvoCardConfig, value: unknown) {
    if (!this.config) return;
    const next: VolvoCardConfig = {
      ...this.config,
      [key]: value === '' || value === undefined ? undefined : value,
    };
    this.config = next;
    this.emit();
  }

  private cars(): string[] {
    const found = Object.keys(this.hass?.states ?? {})
      .map((id) => /^lock\.volvo_([a-z0-9_]+)_lock$/.exec(id)?.[1])
      .filter((car): car is string => !!car);
    return [...new Set([...found, 'ex30', 'xc40'])].sort();
  }

  private choices(): Array<[Row, boolean]> {
    const show =
      this.config?.show !== undefined
        ? this.config.show
        : (['charging', 'openings', 'actions'] as Row[]);
    return ROWS.map((row) => [row, show.includes(row)]);
  }

  private toggleRow(row: Row, on: boolean) {
    const current = this.choices()
      .filter(([, checked]) => checked)
      .map(([key]) => key);
    const next = on
      ? [...new Set([...current, row])]
      : current.filter((key) => key !== row);
    this.set(
      'show',
      ROWS.filter((key) => next.includes(key)),
    );
  }

  private placeholders(): Record<Slot, string> {
    try {
      return this.config
        ? resolveCar(this.config, this.hass).entities
        : ({} as Record<Slot, string>);
    } catch {
      return {} as Record<Slot, string>;
    }
  }

  private entityField(slot: Slot) {
    const value = this.config?.entities?.[slot] ?? '';
    const placeholder = this.placeholders()[slot];
    return html`<label
      >${SLOT_LABELS[slot]}
      <input
        aria-label=${SLOT_LABELS[slot]}
        .value=${value}
        placeholder=${placeholder ?? ''}
        @change=${(event: Event) => {
          const typed = (event.target as HTMLInputElement).value.trim();
          const entities = { ...(this.config?.entities ?? {}) };
          if (typed) entities[slot] = typed;
          else delete entities[slot];
          this.set(
            'entities',
            Object.keys(entities).length ? entities : undefined,
          );
        }}
    /></label>`;
  }

  private overrideFields(field: 'openings' | 'actions') {
    const keys = field === 'openings' ? OPENINGS : ACTIONS;
    const labels: Record<string, string> =
      field === 'openings' ? OPENING_LABELS : ACTION_LABELS;
    return keys.map(
      (key) =>
        html`<label
          >${labels[key]}<input
            aria-label=${`${labels[key]} entity`}
            .value=${(
              this.config?.[field] as Record<string, string> | undefined
            )?.[key] ?? ''}
            @change=${(event: Event) => {
              const value = (event.target as HTMLInputElement).value.trim();
              const next = { ...this.config?.[field] };
              if (value) (next as Record<string, string>)[key] = value;
              else delete (next as Record<string, string>)[key];
              this.set(field, Object.keys(next).length ? next : undefined);
            }}
        /></label>`,
    );
  }
  protected render() {
    if (!this.config) return nothing;
    return html`<p>
        Choose the car and the card fills in the Volvo entities for you: the
        lock, battery, range, the charge sensors, every door, window, the
        bonnet, sunroof, tailgate and charge port, plus the remote buttons.
        Nothing is sent to the car while the dashboard is open.
      </p>
      <label
        >Car<select
          aria-label="Car"
          @change=${(event: Event) =>
            this.set('car', (event.target as HTMLSelectElement).value)}
        >
          ${this.cars().map(
            (car) =>
              html`<option value=${car} ?selected=${this.config!.car === car}>
                ${car.toUpperCase()}
              </option>`,
          )}
        </select></label
      >
      <label
        >Entity prefix<input
          aria-label="Entity prefix"
          .value=${this.config.prefix ?? ''}
          placeholder="volvo_ex30_"
          @change=${(event: Event) =>
            this.set(
              'prefix',
              (event.target as HTMLInputElement).value.trim(),
            )}
      /></label>
      <label
        >Layout<select
          aria-label="Layout"
          @change=${(event: Event) =>
            this.set('layout', (event.target as HTMLSelectElement).value)}
        >
          ${LAYOUTS.map(
            (value) =>
              html`<option
                value=${value}
                ?selected=${(this.config!.layout ?? 'banner') === value}
              >
                ${value === 'banner'
                  ? 'Overview'
                  : value === 'compact'
                    ? 'Compact'
                    : 'Overview (legacy full)'}
              </option>`,
          )}
        </select></label
      >
      <label
        >Picture size<select
          aria-label="Picture size"
          @change=${(event: Event) =>
            this.set('image_size', (event.target as HTMLSelectElement).value)}
        >
          ${IMAGE_SIZES.map(
            (value) =>
              html`<option
                value=${value}
                ?selected=${(this.config!.image_size ?? 'medium') === value}
              >
                ${value}
              </option>`,
          )}
        </select></label
      >
      <label
        >Picture height (optional)<input
          type="number"
          min="32"
          max="260"
          aria-label="Picture height"
          .value=${String(this.config.image_height ?? '')}
          @change=${(event: Event) => {
            const value = (event.target as HTMLInputElement).value;
            this.set('image_height', value === '' ? undefined : Number(value));
          }}
      /></label>
      <label
        >Display name<input
          aria-label="Display name"
          .value=${this.config.name ?? ''}
          placeholder="Volvo EX30"
          @change=${(event: Event) =>
            this.set('name', (event.target as HTMLInputElement).value.trim())}
      /></label>
      <label
        >Picture URL<input
          aria-label="Picture URL"
          .value=${this.config.image ?? ''}
          placeholder="/api/image/serve/…/original"
          @change=${(event: Event) =>
            this.set('image', (event.target as HTMLInputElement).value.trim())}
      /></label>
      <label
        >Picture from entity<select
          aria-label="Picture from entity"
          @change=${(event: Event) =>
            this.set('image_entity', (event.target as HTMLSelectElement).value)}
        >
          <option value="" ?selected=${!this.config.image_entity}>
            Use the car's location picture
          </option>
          ${Object.keys(this.hass?.states ?? {})
            .filter((id) => /^(device_tracker|image|camera)\./.test(id))
            .sort()
            .map(
              (id) =>
                html`<option
                  value=${id}
                  ?selected=${this.config!.image_entity === id}
                >
                  ${this.hass!.states[id].attributes.friendly_name ?? id}
                  (${id})
                </option>`,
            )}
        </select></label
      >
      <h3>Additional details and controls</h3>
      <p>
        Battery, charging state and openings remain visible in the overview.
      </p>
      <div class="rows">
        ${this.choices().map(
          ([row, checked]) =>
            html`<label>
              <input
                type="checkbox"
                data-row=${row}
                .checked=${checked}
                @change=${(event: Event) =>
                  this.toggleRow(
                    row,
                    (event.target as HTMLInputElement).checked,
                  )}
              />
              ${ROW_LABELS[row]}</label
            >`,
        )}
      </div>
      <details>
        <summary>Entity ids</summary>
        <p>
          Leave a field empty to use the standard name for this car. Fill one in
          only when your entity is named differently.
        </p>
        ${SLOTS.map((slot) => this.entityField(slot))}
        <h3>Door and window overrides</h3>
        ${this.overrideFields('openings')}
        <h3>Remote button overrides</h3>
        ${this.overrideFields('actions')}
      </details>`;
  }
}

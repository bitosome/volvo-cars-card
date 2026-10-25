import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens } from './shared/design-tokens';
import {
  familyStyles,
  headerStyles,
  dialogStyles,
  FamilyFlowController,
  renderFamilyDialog,
  componentStyles,
  notice,
  showEntityMoreInfo,
  UI_ICONS,
} from './shared/card-primitives';
import { buildGlow, glowStyles } from './shared/glow';
import { cardStyles } from './styles/card';
import {
  available,
  hassUrl,
  pressable,
  resolveCar,
  validateConfig,
  type Hass,
  type ResolvedCar,
  type VolvoCardConfig,
} from './types';
import {
  deriveCharging,
  deriveOpenings,
  numberValue,
  percentValue,
} from './vehicle-state';
import { VehicleCommands } from './commands';
import { getImageFrame, type ImageFrame } from './image-framing';

const icon = (name: string) =>
  html`<ha-icon .icon=${name} aria-hidden="true"></ha-icon>`;
const percent = (value: number | undefined) =>
  value !== undefined && value >= 0 && value <= 100
    ? Math.round(value)
    : undefined;

/** Rendering, reported vehicle state and command acknowledgement have separate owners. */
@customElement('volvo-cars-card')
export class VolvoCarsCard extends LitElement {
  @property({ attribute: false }) hass?: Hass;
  @state() private config?: VolvoCardConfig;
  @state() private unlockEntity?: string;
  @state() private imageFailed = false;
  @state() private imageFrame?: ImageFrame & { source: string };
  private flow = new FamilyFlowController<'details' | 'climate' | 'unlock'>(this, {
    onChange: (route) => { if (route !== 'unlock') this.unlockEntity = undefined; },
  });
  private unframedImage?: string;
  private lastImage?: string;
  private commands = new VehicleCommands(
    () => this.hass,
    () => this.requestUpdate(),
    { openMoreInfo: (id) => this.moreInfo(id) },
  );
  static styles = [
    designTokens,
    cardStyles,
    familyStyles,
    headerStyles,
    dialogStyles,
    componentStyles,
    glowStyles,
  ];
  static getConfigElement() {
    return document.createElement('volvo-cars-card-editor');
  }
  static getStubConfig(hass: Hass) {
    const id = Object.keys(hass.states ?? {}).find((id) =>
      /^lock\.volvo_[a-z0-9_]+_lock$/.test(id),
    );
    return {
      type: 'custom:volvo-cars-card',
      car: id?.replace(/^lock\.volvo_/, '').replace(/_lock$/, '') ?? 'ex30',
    };
  }
  setConfig(raw: VolvoCardConfig) {
    const config = validateConfig(raw);
    this.commands.reset();
    this.disposeDialogs();
    this.config = config;
    this.unlockEntity = undefined;
    this.imageFailed = false;
    this.imageFrame = undefined;
    this.unframedImage = undefined;
  }
  getCardSize() {
    return this.config?.layout === 'compact' ? 4 : 7;
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this.commands.reset();
    this.disposeDialogs();
    this.unlockEntity = undefined;
  }
  protected updated(changed: PropertyValues) {
    super.updated(changed);
    if (changed.has('hass')) {
      this.commands.update();
      const image = this.car?.image;
      if (image !== this.lastImage) {
        this.lastImage = image;
        this.imageFailed = false;
        this.unframedImage = undefined;
      }
    }
  }
  private get car() {
    return this.config ? resolveCar(this.config, this.hass) : undefined;
  }
  private entity(id: string) {
    return this.hass?.states[id];
  }
  private moreInfo(entityId?: string) {
    if (entityId) this.flow.handoff(() => showEntityMoreInfo(this, entityId));
  }
  private frameImage(event: Event) {
    const image = event.currentTarget as HTMLImageElement;
    const source = image.getAttribute('src');
    if (
      !source ||
      source === this.unframedImage ||
      source !== hassUrl(this.hass!, this.car?.image ?? '')
    )
      return;
    const frame = getImageFrame(image);
    if (frame) this.imageFrame = { ...frame, source };
  }
  private imageError(source: string, framed = false) {
    if (source !== hassUrl(this.hass!, this.car?.image ?? '')) return;
    if (framed) {
      // Retry with the regular image once, without entering a framing loop.
      this.unframedImage = source;
      this.imageFrame = undefined;
    } else {
      this.imageFailed = true;
    }
  }
  private closeDialog(_selector: string) { this.flow.close(); }
  private disposeDialogs() { this.flow.forceClose(false); }
  private openDialog(selector: string, opener?: HTMLElement) {
    const route = selector.replace('.', '').replace('-dialog', '') as 'details' | 'climate' | 'unlock';
    this.flow.open(route, opener);
  }
  private canService(domain: string, service: string) {
    return (
      !!this.hass &&
      (!this.hass.services || !!this.hass.services[domain]?.[service])
    );
  }
  private get busy() {
    return !!this.commands.pending;
  }
  private async lockAction(car: ResolvedCar, opener?: HTMLElement) {
    if (this.busy) return;
    const entity = this.entity(car.entities.lock);
    if (!entity || !['locked', 'unlocked'].includes(entity.state)) return;
    if (entity.attributes.code_format || entity.attributes.code_required) {
      this.moreInfo(car.entities.lock);
      return;
    }
    if (entity.state === 'locked') {
      this.unlockEntity = car.entities.lock;
      await this.openDialog('.unlock-dialog', opener);
    } else await this.commands.lock(car.entities.lock, 'locked');
  }
  private async confirmUnlock() {
    const id = this.unlockEntity;
    this.unlockEntity = undefined;
    this.closeDialog('.unlock-dialog');
    // Confirmation belongs to this car and this action; never invert it after a state change.
    if (
      id &&
      id === this.car?.entities.lock &&
      this.entity(id)?.state === 'locked' &&
      !this.busy
    )
      await this.commands.lock(id, 'unlocked');
  }
  private feedback() {
    const f = this.commands.feedback;
    return f ? notice({
      message: f.message,
      tone: f.kind === 'error' ? 'error' : f.kind === 'success' ? 'success' : 'neutral',
      action: f.kind !== 'pending' ? { label: 'Dismiss', onClick: () => this.commands.clearFeedback() } : undefined,
    }) : nothing;
  }
  private statusLock(car: ResolvedCar) {
    const state = this.entity(car.entities.lock)?.state;
    return state === 'locked'
      ? 'Locked'
      : state === 'unlocked'
        ? 'Unlocked'
        : state === 'locking'
          ? 'Locking…'
          : state === 'unlocking'
            ? 'Unlocking…'
            : state === 'jammed'
              ? 'Lock needs attention'
              : 'Lock unavailable';
  }
  private actionButtons(car: ResolvedCar, climate = false) {
    const list = car.actions.filter(
      (a) =>
        a.key.includes('climatisation') === climate &&
        pressable(this.entity(a.entity)),
    );
    return list.map(
      (a) =>
        html`<button
          class="action family-action quiet"
          data-action=${a.key}
          ?disabled=${this.busy || !this.canService('button', 'press')}
          @click=${() => this.commands.press(a.entity, a.label)}
        >
          ${icon(a.icon)}${a.label}
        </button>`,
    );
  }
  private details(car: ResolvedCar) {
    const charge = deriveCharging(this.hass!, car),
      openings = deriveOpenings(this.hass!, car);
    const odometer = this.entity(car.entities.odometer);
    const updates = [
      car.entities.battery,
      car.entities.charging_status,
      car.entities.lock,
    ].map((id) => ({
      id,
      label:
        id === car.entities.battery
          ? 'Battery'
          : id === car.entities.lock
            ? 'Lock'
            : 'Charging',
      at: this.entity(id)?.last_updated,
    }));
    return html`<section
      class="details"
      id="car-details"
      aria-label="Car details"
    >
      ${
        car.show.includes('charging')
          ? html`<div class="detail-section">
              <h3>Charging details</h3>
              <p>${charge.detail}</p>
              <dl>
                ${charge.diagnostics.map(
                  (d) =>
                    html`<div>
                      <dt>${d.label}</dt>
                      <dd>
                        <button
                          class="text-button"
                          @click=${() => this.moreInfo(d.entity)}
                        >
                          ${d.value}
                        </button>
                      </dd>
                    </div>`,
                )}
              </dl>
            </div>`
          : nothing
      }
      ${
        car.show.includes('openings')
          ? html`<div class="detail-section">
              <h3>Doors & windows</h3>
              <p>${openings.detail}</p>
              <div class="opening-grid">
                ${car.openings
                  .filter((o) => this.entity(o.entity))
                  .map((o) => {
                    const state = this.entity(o.entity)?.state;
                    const expected =
                      o.key === 'tank_lid' && charge.connection === 'connected';
                    const label = expected
                      ? 'Cable connected'
                      : state === 'on'
                        ? 'Open'
                        : state === 'off'
                          ? 'Closed'
                          : 'Unavailable';
                    return html`<button
                      class="opening-item ${
                        !expected && state === 'on' ? 'warning' : ''
                      }"
                      @click=${() => this.moreInfo(o.entity)}
                    >
                      ${icon(o.icon)}<span
                        >${o.label}<small>${label}</small></span
                      >
                    </button>`;
                  })}
              </div>
            </div>`
          : nothing
      }
      ${
        car.show.includes('actions') && this.actionButtons(car).length
          ? html`<div class="detail-section">
              <h3>Find your car</h3>
              <div class="actions">${this.actionButtons(car)}</div>
            </div>`
          : nothing
      }
      ${
        car.imageEntity && available(this.entity(car.imageEntity))
          ? html`<button
              class="detail-row"
              data-action="location"
              @click=${() => this.moreInfo(car.imageEntity)}
            >
              <span>${icon('mdi:map-marker-outline')}Car location</span>${icon(
                'mdi:chevron-right',
              )}
            </button>`
          : nothing
      }
      ${
        car.show.includes('odometer') && available(odometer)
          ? html`<button
              class="detail-row"
              @click=${() => this.moreInfo(car.entities.odometer)}
            >
              <span>Odometer</span
              ><strong
                >${odometer!.state}
                ${odometer!.attributes.unit_of_measurement ?? 'km'}</strong
              >
            </button>`
          : nothing
      }
      <details class="update-details">
        <summary>Reading timestamps</summary>
        <p>
          When these readings last changed in Home Assistant. Unchanged readings
          keep their timestamp; this is not a live connection check.
        </p>
        <dl>
          ${updates.map(
            (u) =>
              html`<div>
                <dt>${u.label}</dt>
                <dd>
                  ${
                    u.at && Number.isFinite(Date.parse(u.at))
                      ? html`<time datetime=${u.at}
                          >${new Intl.DateTimeFormat(
                            this.hass?.locale?.language,
                            { dateStyle: 'short', timeStyle: 'short' },
                          ).format(new Date(u.at))}</time
                        >`
                      : 'Unavailable'
                  }
                </dd>
              </div>`,
          )}
        </dl>
      </details>
    </section>`;
  }
  protected render() {
    const car = this.car;
    if (!car || !this.hass)
      return html`<ha-card
        ><p class="empty">
          ${
            car
              ? 'Waiting for Home Assistant…'
              : 'Choose a car in the card settings.'
          }
        </p></ha-card
      >`;
    const charge = deriveCharging(this.hass, car),
      openings = deriveOpenings(this.hass, car);
    const battery = percent(percentValue(this.entity(car.entities.battery))),
      target = percent(percentValue(this.entity(car.entities.charging_target)));
    const range = this.entity(car.entities.range),
      rangeValue = numberValue(range);
    const lock = this.entity(car.entities.lock),
      knownLock = lock && ['locked', 'unlocked'].includes(lock.state);
    const locking = lock?.state === 'unlocked';
    const lockIcon =
      lock?.state === 'locked'
        ? 'mdi:lock-outline'
        : lock?.state === 'unlocked'
          ? 'mdi:lock-open-variant-outline'
          : 'mdi:lock-alert-outline';
    const command = this.commands.pending;
    const lockLabel =
      command?.entity === car.entities.lock
        ? command.target === 'unlocked'
          ? 'Unlocking…'
          : 'Locking…'
        : !knownLock
          ? this.statusLock(car)
          : locking
            ? 'Lock car'
            : 'Unlock';
    const image = hassUrl(this.hass, car.image ?? '');
    const frame =
      this.imageFrame?.source === image ? this.imageFrame : undefined;
    const climate =
      car.show.includes('actions') &&
      car.actions.some(
        (a) =>
          a.key.includes('climatisation') && pressable(this.entity(a.entity)),
      );
    const glow = buildGlow(
      charge.tone === 'error'
        ? { weak: 'rgba(229,57,53,.2)', strong: 'rgba(229,57,53,.4)' }
        : charge.active
          ? { weak: 'rgba(103,168,245,.15)', strong: 'rgba(103,168,245,.32)' }
          : undefined,
      charge.active ? 'pulse' : 'static',
      charge.active || charge.tone === 'error',
    );
    return html`<div class="outer">
        <ha-card
          ><div class="root">
            <div class="tile-wrap">
              <div class="glow-under" style=${glow.style}>${glow.overlay}</div>
              <section
                class="surface vehicle ${car.layout}"
                aria-label=${`${car.name} status`}
              >
                <header class="identity family-header">
                  <h2 class="family-title">${car.name}</h2>
                </header>
                ${
                  image && !this.imageFailed
                    ? html`<div
                        class="vehicle-image"
                        style=${`--image-height:${car.layout === 'compact' ? car.thumb.height : car.bannerHeight}px`}
                      >
                        ${
                          frame
                            ? html`<svg
                                viewBox=${frame.viewBox}
                                role="img"
                                aria-label=${car.name}
                              >
                                <image
                                  href=${image}
                                  width=${frame.naturalWidth}
                                  height=${frame.naturalHeight}
                                  @error=${() => this.imageError(image, true)}
                                ></image>
                              </svg>`
                            : html`<img
                                src=${image}
                                alt=${car.name}
                                referrerpolicy="no-referrer"
                                @load=${this.frameImage}
                                @error=${() => this.imageError(image)}
                              />`
                        }
                      </div>`
                    : nothing
                }
                <div class="energy">
                  <button
                    class="battery-figure"
                    data-action="identity"
                    @click=${() => this.moreInfo(car.entities.battery)}
                    aria-label=${`Battery ${battery === undefined ? 'unavailable' : `${battery} percent`}`}
                  >
                    <span class="battery-value"
                      >${battery ?? '—'}<small>%</small></span
                    ><span class="caption"
                      >Battery${
                        target !== undefined ? ` · Target ${target}%` : ''
                      }</span
                    >
                  </button>
                  <div class="range-figure">
                    <span
                      >${
                        rangeValue !== undefined && rangeValue >= 0
                          ? Math.round(rangeValue)
                          : '—'
                      }
                      <small
                        >${range?.attributes.unit_of_measurement ?? 'km'}</small
                      ></span
                    ><span class="caption">Estimated range</span>
                  </div>
                </div>
                <div
                  class="battery-track"
                  role="meter"
                  aria-label="Battery level"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow=${battery ?? nothing}
                  aria-valuetext=${
                    battery === undefined
                      ? 'Unavailable'
                      : `${battery}%${target !== undefined ? `, target ${target}%` : ''}`
                  }
                >
                  <span
                    class="battery-fill ${charge.active ? 'active' : ''}"
                    style=${`width:${battery ?? 0}%`}
                  ></span
                  >${
                    target !== undefined
                      ? html`<span
                          class="target-marker"
                          style=${`left:${target}%`}
                        ></span>`
                      : nothing
                  }
                </div>
                <div class="status-overview">
                  <button
                    class="charging-status ${charge.tone}"
                    @click=${() =>
                      this.moreInfo(
                        charge.connection === 'fault' ||
                          charge.connection === 'unknown'
                          ? car.entities.charging_connection
                          : car.entities.charging_status,
                      )}
                  >
                    <span class="status-symbol"
                      >${icon(
                        charge.tone === 'error'
                          ? 'mdi:alert-circle-outline'
                          : charge.active
                            ? 'mdi:battery-charging-outline'
                            : charge.connection === 'disconnected'
                              ? 'mdi:power-plug-off-outline'
                              : 'mdi:ev-station',
                      )}</span
                    ><span class="status-copy"
                      ><strong>${charge.label}</strong>${
                        charge.active && (charge.power || charge.remaining)
                          ? html`<span
                              >${[
                                charge.power,
                                charge.remaining
                                  ? `${charge.remaining} remaining`
                                  : undefined,
                              ]
                                .filter(Boolean)
                                .join(' · ')}</span
                            >`
                          : nothing
                      }</span
                    >${icon('mdi:chevron-right')}
                  </button>
                  <div
                    class="openings ${openings.tone} ${
                      openings.open.length || openings.unknown.length
                        ? 'needs-attention'
                        : ''
                    }"
                  >
                    <div class="opening-pills">
                      ${openings.open.map(
                        (o) =>
                          html`<button
                            class="opening-pill warning"
                            data-opening=${o.key}
                            aria-label=${`${o.label} open`}
                            @click=${() => this.moreInfo(o.entity)}
                          >
                            ${icon(o.icon)}${o.label}
                          </button>`,
                      )}
                      ${
                        openings.unknown.length
                          ? html`<span
                              class="opening-pill neutral"
                              title=${openings.detail}
                            >
                              ${icon('mdi:help-circle-outline')}
                              ${
                                !openings.open.length &&
                                openings.label === 'Openings unavailable'
                                  ? openings.label
                                  : `${openings.unknown.length} ${openings.unknown.length === 1 ? 'sensor unavailable' : 'sensors unavailable'}`
                              }
                            </span>`
                          : !openings.open.length
                            ? html`<span
                                class="opening-pill neutral"
                                title=${openings.detail}
                              >
                                ${icon('mdi:shield-check-outline')}${openings.label}
                              </span>`
                            : nothing
                      }
                    </div>
                  </div>
                </div>
                <div class="controls">
                  <button
                    class="action family-action ${locking ? 'primary' : 'secondary'}"
                    data-action="lock"
                    title=${`${this.statusLock(car)} — ${lockLabel}`}
                    ?disabled=${
                      !knownLock ||
                      this.busy ||
                      !this.canService('lock', locking ? 'lock' : 'unlock')
                    }
                    @click=${(event: Event) => this.lockAction(car, event.currentTarget as HTMLElement)}
                  >
                    ${icon(lockIcon)}${lockLabel}</button
                  >${
                    climate
                      ? html`<button
                          class="action family-action secondary"
                          data-action="climate"
                          aria-haspopup="dialog"
                          @click=${(event: Event) => this.openDialog('.climate-dialog', event.currentTarget as HTMLElement)}
                        >
                          ${icon('mdi:fan')}Climate
                        </button>`
                      : nothing
                  }<button
                    class="action family-action secondary"
                    data-action="disclosure"
                    aria-haspopup="dialog"
                    aria-controls="car-details-dialog"
                    @click=${(event: Event) => {
                      this.openDialog(
                        '.details-dialog',
                        event.currentTarget as HTMLElement,
                      );
                    }}
                  >
                    ${icon('mdi:information-outline')}Details
                  </button>
                </div>
                ${this.feedback()}
              </section>
            </div>
          </div></ha-card
        >
      </div>
      ${renderFamilyDialog(this.flow, {
        title: this.flow.current === 'unlock' ? `Unlock ${car.name}?` : `${this.flow.current === 'climate' ? 'Climate' : 'Details'} · ${car.name}`,
        className: `${this.flow.current}-dialog`,
        id: this.flow.current === 'details' ? 'car-details-dialog' : undefined,
        long: this.flow.current === 'details',
        bodyClass: this.flow.current === 'details' ? 'details-content' : undefined,
        content: this.flow.current === 'details' ? html`${this.feedback()}${this.details(car)}`
          : this.flow.current === 'climate' ? html`<p>Precondition the cabin before you leave.</p><div class="actions">${this.actionButtons(car, true)}</div>${this.feedback()}`
          : html`<p>This unlocks the car remotely.</p>`,
        footer: this.flow.current === 'unlock' ? html`
          <button class="action family-action secondary" data-action="cancel-unlock" data-family-initial-focus @click=${() => this.flow.close()}>Cancel</button>
          <button class="action family-action primary" data-action="confirm-unlock"
            ?disabled=${this.busy || this.unlockEntity !== car.entities.lock || lock?.state !== 'locked'}
            @click=${() => this.confirmUnlock()}>${icon(lockIcon)}Unlock car</button>` : undefined,
      })}`;
  }
}
const cardWindow = window as typeof window & {
  customCards?: Array<Record<string, unknown>>;
};
cardWindow.customCards = cardWindow.customCards || [];
cardWindow.customCards.push({
  type: 'volvo-cars-card',
  name: 'Volvo Cars Card',
  description: 'Battery, charging, doors, windows and controls for your Volvo.',
  preview: true,
});
console.info('VOLVO CARS CARD 0.7.0');

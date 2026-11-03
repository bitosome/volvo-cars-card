import { chargingGlow } from './charging-glow';
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
  pendingIndicator,
  notice,
  asyncState,
  stateChip,
  levelMeter,
  batteryTone,
  formatHassNumber,
  formatHassDateTime,
  UNAVAILABLE_TEXT,
  showEntityMoreInfo,
  UI_ICONS,
} from './shared/card-primitives';
import { glowStyles } from './shared/glow';
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
  private measuredImage?: { element: HTMLImageElement; source: string };
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
    this.measuredImage = undefined;
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
        this.measuredImage = undefined;
      }
    }
    // Cached images and HA reconfiguration may not emit another load event.
    const image = this.renderRoot.querySelector<HTMLImageElement>('.vehicle-image img');
    if (image?.complete && image.naturalWidth > 0) this.measureImage(image);
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
    this.measureImage(event.currentTarget as HTMLImageElement);
  }
  private measureImage(image: HTMLImageElement) {
    const source = image.getAttribute('src');
    if (!source || image !== this.renderRoot.querySelector('.vehicle-image img') ||
        source !== hassUrl(this.hass, this.car?.image ?? '') ||
        (this.measuredImage?.element === image && this.measuredImage.source === source)) return;
    if (!image.complete || !image.naturalWidth) return;
    this.measuredImage = { element: image, source };
    const frame = getImageFrame(image);
    this.imageFrame = frame ? { ...frame, source } : undefined;
  }
  private imageError(source: string) {
    if (source !== hassUrl(this.hass, this.car?.image ?? '')) return;
    this.imageFailed = true;
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
  private feedback(main = false) {
    const f = this.commands.feedback;
    if (!f || f.kind === 'pending' || (main && f.kind !== 'error')) return nothing;
    return notice({
      message: f.message,
      tone: f.kind === 'error' ? 'error' : f.kind === 'success' ? 'success' : 'neutral',
      action: { label: 'Dismiss', onClick: () => this.commands.clearFeedback() },
    });
  }
  private liveFeedback(modal = false) {
    const f = this.commands.feedback;
    const message = modal
      ? f?.kind === 'pending' ? f.message : ''
      : !this.flow.current && f?.kind !== 'error' ? f?.message ?? '' : '';
    return html`<span class="family-visually-hidden" role="status" aria-live="polite" aria-atomic="true">${message}</span>`;
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
          class="family-action quiet"
          data-action=${a.key}
          aria-busy=${this.commands.pending?.entity === a.entity ? 'true' : 'false'}
          aria-label=${`${a.label} · ${car.name}${this.commands.pending?.entity === a.entity ? ': Sending request' : ''}`}
          ?disabled=${this.busy || !this.canService('button', 'press')}
          @click=${() => this.commands.press(a.entity, a.label)}
        >
          ${this.commands.pending?.entity === a.entity ? pendingIndicator() : icon(a.icon)}${this.commands.pending?.entity === a.entity ? 'Sending…' : a.label}
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
                          class="family-action quiet diagnostic"
                          aria-haspopup="dialog"
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
                      aria-haspopup="dialog"
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
              aria-haspopup="dialog"
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
              aria-haspopup="dialog"
              @click=${() => this.moreInfo(car.entities.odometer)}
            >
              <span>Odometer</span
              ><strong
                >${formatHassNumber(this.hass, odometer!.state, {
                  unit: String(odometer!.attributes.unit_of_measurement ?? 'km'),
                })}</strong
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
                          >${formatHassDateTime(this.hass, u.at)}</time
                        >`
                      : html`<span class="family-unavailable">${UNAVAILABLE_TEXT}</span>`
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
        ><div class="empty">
          ${
            car
              ? asyncState({ state: 'loading', message: 'Waiting for Home Assistant…' })
              : asyncState({ state: 'empty', message: 'Choose a car in the card settings.' })
          }
        </div></ha-card
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
        ? 'mdi:lock'
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
            ? 'Lock'
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
    const glow = chargingGlow(charge, this.entity(this.config?.controller_entity ?? ''));
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
                        <div class="image-frame ${frame ? 'cropped' : ''}"
                          style=${frame ? `--frame-ratio:${frame.width / frame.height}` : ''}>
                          <img
                            src=${image}
                            alt=${car.name}
                            referrerpolicy="no-referrer"
                            style=${frame ? `width:${frame.naturalWidth / frame.width * 100}%;height:${frame.naturalHeight / frame.height * 100}%;left:${-frame.x / frame.width * 100}%;top:${-frame.y / frame.height * 100}%` : ''}
                            @load=${this.frameImage}
                            @error=${() => this.imageError(image)}
                          />
                        </div>
                      </div>`
                    : nothing
                }
                <div class="energy">
                  <button
                    class="battery-figure"
                    data-action="identity"
                    aria-haspopup="dialog"
                    @click=${() => this.moreInfo(car.entities.battery)}
                    aria-label=${`Battery ${battery === undefined ? 'unavailable' : `${battery} percent`}`}
                  >
                    ${
                      battery === undefined
                        ? html`<span class="battery-value family-unavailable"
                            >${UNAVAILABLE_TEXT}</span
                          >`
                        : html`<span class="battery-value"
                            >${formatHassNumber(this.hass, battery, { digits: 0 })}<small>%</small></span
                          >`
                    }<span class="caption"
                      >Battery${
                        target !== undefined ? ` · Target ${target}%` : ''
                      }</span
                    >
                  </button>
                  <div class="range-figure">
                    ${
                      rangeValue !== undefined && rangeValue >= 0
                        ? html`<span
                            >${formatHassNumber(this.hass, rangeValue, { digits: 0 })}
                            <small
                              >${range?.attributes.unit_of_measurement ?? 'km'}</small
                            ></span
                          >`
                        : html`<span class="family-unavailable">${UNAVAILABLE_TEXT}</span>`
                    }<span class="caption">Estimated range</span>
                  </div>
                </div>
                ${levelMeter({
                  value: battery,
                  label: 'Battery level',
                  valueText:
                    battery === undefined
                      ? UNAVAILABLE_TEXT
                      : `${battery}%${target !== undefined ? `, target ${target}%` : ''}`,
                  tone: batteryTone(battery),
                  target,
                  className: 'battery-meter',
                })}
                <div class="status-overview">
                  ${stateChip({
                    label: charge.label,
                    // Charging keeps the neutral tone plus the card-owned active tint; unknown plug data is unavailable.
                    tone: charge.tone === 'error' ? 'error' : charge.connection === 'unknown' ? 'unavailable' : 'neutral',
                    className: `charging-status ${charge.tone}`,
                    hasPopup: 'dialog',
                    icon:
                      charge.tone === 'error'
                        ? 'mdi:alert-circle-outline'
                        : charge.active
                          ? 'mdi:battery-charging-outline'
                          : charge.connection === 'disconnected'
                            ? 'mdi:power-plug-off-outline'
                            : 'mdi:ev-station',
                    secondary:
                      charge.active && (charge.power || charge.remaining)
                        ? [
                            charge.power,
                            charge.remaining ? `${charge.remaining} remaining` : undefined,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                        : undefined,
                    onClick: () =>
                      this.moreInfo(
                        charge.connection === 'fault' ||
                          charge.connection === 'unknown'
                          ? car.entities.charging_connection
                          : car.entities.charging_status,
                      ),
                  })}
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
                            type="button"
                            class="family-chip opening-pill"
                            data-tone="warning"
                            data-opening=${o.key}
                            aria-label=${`${o.label} open`}
                            aria-haspopup="dialog"
                            @click=${() => this.moreInfo(o.entity)}
                          >
                            ${icon(o.icon)}${o.label}
                          </button>`,
                      )}
                      ${
                        openings.unknown.length
                          ? stateChip({
                              label:
                                !openings.open.length &&
                                openings.label === 'Openings unavailable'
                                  ? openings.label
                                  : `${openings.unknown.length} ${openings.unknown.length === 1 ? 'sensor unavailable' : 'sensors unavailable'}`,
                              icon: 'mdi:help-circle-outline',
                              tone: 'unavailable',
                              title: openings.detail,
                              className: 'opening-pill',
                            })
                          : nothing
                      }
                    </div>
                  </div>
                </div>
                <div class="controls">
                  <button
                    class="family-action ${locking ? 'primary' : 'secondary'}"
                    data-action="lock"
                    aria-haspopup=${locking && !lock?.attributes.code_format && !lock?.attributes.code_required ? 'false' : 'dialog'}
                    title=${`${this.statusLock(car)} — ${lockLabel}`}
                    aria-label=${`${car.name}: ${this.statusLock(car)}. ${lockLabel}`}
                    aria-busy=${command?.entity === car.entities.lock ? "true" : "false"}
                    ?disabled=${
                      !knownLock ||
                      this.busy ||
                      !this.canService('lock', locking ? 'lock' : 'unlock')
                    }
                    @click=${(event: Event) => this.lockAction(car, event.currentTarget as HTMLElement)}
                  >
                    ${command?.entity === car.entities.lock ? pendingIndicator() : icon(lockIcon)}${lockLabel}</button
                  >${
                    climate
                      ? html`<button
                          class="family-action secondary"
                          data-action="climate"
                          aria-label=${`Climate · ${car.name}`}
                          aria-haspopup="dialog"
                          @click=${(event: Event) => this.openDialog('.climate-dialog', event.currentTarget as HTMLElement)}
                        >
                          ${icon('mdi:fan')}Climate
                        </button>`
                      : nothing
                  }<button
                    class="family-action secondary"
                    data-action="disclosure"
                    aria-label=${`Details · ${car.name}`}
                    aria-haspopup="dialog"
                    aria-controls="car-details-dialog"
                    @click=${(event: Event) => {
                      this.openDialog(
                        '.details-dialog',
                        event.currentTarget as HTMLElement,
                      );
                    }}
                  >
                    ${icon(UI_ICONS.details)}Details
                  </button>
                </div>
                ${this.feedback(true)}
                ${this.liveFeedback()}
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
        content: html`${this.liveFeedback(true)}${this.flow.current === 'details' ? html`${this.feedback()}${this.details(car)}`
          : this.flow.current === 'climate' ? html`<p>Precondition the cabin before you leave.</p><div class="actions">${this.actionButtons(car, true)}</div>${this.feedback()}`
          : html`<p>This unlocks the car remotely.</p>`}`,
        footerLayout: 'equal',
        footer: this.flow.current === 'unlock' ? html`
          <button class="family-action secondary" data-action="cancel-unlock" data-family-initial-focus @click=${() => this.flow.close()}>Cancel</button>
          <button class="family-action primary" data-action="confirm-unlock"
            ?disabled=${this.busy || this.unlockEntity !== car.entities.lock || lock?.state !== 'locked'}
            @click=${() => this.confirmUnlock()}>${icon(lockIcon)}Unlock</button>` : undefined,
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
console.info('VOLVO CARS CARD 0.8.1');

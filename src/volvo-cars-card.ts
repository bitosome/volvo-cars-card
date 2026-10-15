import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { designTokens } from './shared/design-tokens';
import { buildGlow } from './shared/glow';
import { cardStyles } from './styles/card';
import {
  available, hassUrl, humanize, numeric, pressable, resolveCar, validateConfig,
  type Hass, type ResolvedCar, type VolvoCardConfig,
} from './types';

const PENDING_TIMEOUT = 20000;
const FEEDBACK_TIMEOUT = 4000;
const POWER_STATUS_OK = new Set(['', 'unknown', 'unavailable', 'none', 'ok', 'idle', 'disconnected', 'charging']);
const CHARGING_LABELS: Record<string, string> = { charging: 'Charging', idle: 'Idle', done: 'Charged', complete: 'Charged', 'smart_charging': 'Smart charging' };

/**
 * One card per car. It reads the Volvo integration's entities and only ever acts
 * on a press: nothing is sent on load, and a missing or unavailable entity is
 * shown as such instead of being guessed.
 */
@customElement('volvo-cars-card')
export class VolvoCarsCard extends LitElement {
  @property({ attribute: false }) hass?: Hass;
  @state() private config?: VolvoCardConfig;
  @state() private pending = '';
  @state() private feedback = '';
  private pendingTimer?: ReturnType<typeof setTimeout>;
  private feedbackTimer?: ReturnType<typeof setTimeout>;

  static styles = [designTokens, cardStyles];

  static getConfigElement() { return document.createElement('volvo-cars-card-editor'); }

  static getStubConfig(hass: Hass) {
    const found = Object.keys(hass.states ?? {}).find(id => /^lock\.volvo_[a-z0-9]+_lock$/.test(id));
    const car = found?.replace(/^lock\.volvo_/, '').replace(/_lock$/, '');
    return { type: 'custom:volvo-cars-card', ...(car ? { car } : { car: 'ex30' }) };
  }

  setConfig(config: VolvoCardConfig) {
    this.config = validateConfig(config);
    this.pending = '';
    this.feedback = '';
  }

  getCardSize() { return 8; }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.clearTimers();
  }

  private clearTimers() {
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.pendingTimer = undefined;
    this.feedbackTimer = undefined;
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    // A command is settled as soon as the entity reports the state we asked for,
    // so the optimistic label never lingers once telemetry catches up.
    if (!changed.has('hass') || !this.pending) return;
    const entity = this.hass?.states[this.pending];
    if (entity && !available(entity)) return;
    if (this.pending.startsWith('lock.') && ['locked', 'unlocked'].includes(entity?.state ?? '')) this.settle();
  }

  private get car(): ResolvedCar | undefined {
    if (!this.config) return undefined;
    try { return resolveCar(this.config, this.hass); } catch { return undefined; }
  }

  private entity(id?: string) { return id ? this.hass?.states[id] : undefined; }

  private note(message: string) {
    this.feedback = message;
    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => { this.feedback = ''; }, FEEDBACK_TIMEOUT);
  }

  private settle() {
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = undefined;
    this.pending = '';
  }

  private watchPending(entityId: string) {
    this.pending = entityId;
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = setTimeout(() => {
      if (this.pending === entityId) { this.pending = ''; this.note('The car did not confirm that command.'); }
    }, PENDING_TIMEOUT);
  }

  private moreInfo(entityId?: string) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId }, bubbles: true, composed: true }));
  }

  private async lockAction(car: ResolvedCar, lock: { state: string }) {
    const entityId = car.entities.lock;
    if (!pressable(this.entity(entityId))) return;
    const wanted = lock.state === 'locked' ? 'unlock' : 'lock';
    this.pending = entityId;
    this.watchPending(entityId);
    this.feedback = '';
    try {
      await this.hass!.callService('lock', wanted, { entity_id: entityId });
    } catch (error) {
      this.settle();
      this.note(error instanceof Error ? error.message : 'The command could not be sent.');
    }
  }

  private async press(entityId: string, label: string) {
    if (!pressable(this.entity(entityId))) return;
    this.watchPending(entityId);
    try {
      await this.hass!.callService('button', 'press', { entity_id: entityId });
      this.note(`${label} sent.`);
    } catch (error) {
      this.note(error instanceof Error ? error.message : `${label} could not be sent.`);
    } finally {
      if (this.pending === entityId) this.settle();
    }
  }

  private renderHero(car: ResolvedCar) {
    const battery = this.entity(car.entities.battery);
    const range = this.entity(car.entities.range);
    const lock = this.entity(car.entities.lock);
    const percent = numeric(battery);
    const target = numeric(this.entity(car.entities.charging_target));
    const image = hassUrl(this.hass, car.image ?? '');
    const unlocked = lock?.state === 'unlocked';
    const jammed = !!lock && !['locked', 'unlocked', 'locking', 'unlocking'].includes(lock.state) && available(lock);
    const locked = lock?.state === 'locked';
    const busy = this.pending === car.entities.lock;
    return html`
      <div class="tile-wrap">
        ${buildGlow(undefined, 'static', false).overlay}
        <section class="surface hero" aria-label=${`${car.name} status`}>
          <div class="hero-media ${image ? '' : 'empty'}" role="button" tabindex="0" aria-label=${`Show ${car.name} location`}
               @click=${() => this.moreInfo(car.imageEntity)}
               @keydown=${(event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.moreInfo(car.imageEntity); } }}>
            ${image ? html`<img src=${image} alt=${car.name} referrerpolicy="no-referrer" />` : nothing}
            <div class="hero-scrim"><div class="identity">
              <span class="car-badge"><ha-icon .icon=${'mdi:car'}></ha-icon></span>
              <span class="identity-text">
                <span class="eyebrow">Volvo</span>
                <div class="name">${car.name}</div>
              </span>
            </div></div>
          </div>
          <div class="figures">
            <div class="figure" role="button" tabindex="0" aria-label=${`Battery ${percent ?? 'unavailable'}`}
                 @click=${() => this.moreInfo(car.entities.battery)}
                 @keydown=${(event: KeyboardEvent) => { if (event.key === 'Enter') this.moreInfo(car.entities.battery); }}>
              <span class="figure-value">${percent === undefined ? '—' : Math.round(percent)}<span class="figure-unit">%</span></span>
              <span class="figure-caption">Battery</span>
            </div>
            <div class="figure secondary" role="button" tabindex="0" aria-label="Distance to empty"
                 @click=${() => this.moreInfo(car.entities.range)}
                 @keydown=${(event: KeyboardEvent) => { if (event.key === 'Enter') this.moreInfo(car.entities.range); }}>
              <span class="figure-value">${available(range) ? range!.state : '—'}</span>
              <span class="figure-unit">${range?.attributes?.unit_of_measurement ?? 'km'}</span>
            </div>
          </div>
          <div class="level" role="img" aria-label=${`Battery level ${percent ?? 'unknown'} percent`}>
            <span style=${`width:${Math.min(100, Math.max(0, percent ?? 0))}%`}></span>
            ${target !== undefined ? html`<span class="level target" style=${`left:${Math.min(100, Math.max(0, target))}%`} title=${`Target ${target}%`}></span>` : nothing}
          </div>
          <div class="hero-foot">
            ${lock
              ? html`<span class="pill ${unlocked ? 'unlocked' : jammed ? 'alert' : ''}"><ha-icon .icon=${locked ? 'mdi:lock' : unlocked ? 'mdi:lock-open-variant' : 'mdi:lock-alert'}></ha-icon>${jammed ? humanize(lock.state) : locked ? 'Locked' : unlocked ? 'Unlocked' : humanize(lock.state)}</span>`
              : nothing}
            ${available(range) ? html`<span class="pill"><ha-icon .icon=${'mdi:map-marker-distance'}></ha-icon>${range!.state} ${range?.attributes?.unit_of_measurement ?? 'km'} left</span>` : nothing}
            ${this.pending === car.entities.lock ? html`<span class="pill live"><ha-icon .icon=${'mdi:progress-clock'}></ha-icon>${busy && locked ? 'Unlocking…' : 'Locking…'}</span>` : nothing}
          </div>
        </section>
      </div>`;
  }

  private renderLock(car: ResolvedCar) {
    const entity = this.entity(car.entities.lock);
    const busy = this.pending === car.entities.lock;
    const usable = pressable(entity);
    const locking = entity?.state === 'locked';
    const label = !usable ? 'Lock unavailable' : busy ? (locking ? 'Unlocking…' : 'Locking…') : locking ? 'Unlock' : 'Lock';
    return html`<div class="actions">
      <button class="action primary" data-action="lock" ?disabled=${!usable || busy}
              @click=${() => entity && this.lockAction(car, entity)}>
        <ha-icon .icon=${locking ? 'mdi:lock-open-variant' : 'mdi:lock'}></ha-icon>${label}
      </button>
      ${car.actions.length ? html`<button class="action secondary" data-action="actions" @click=${() => this.moreInfo(car.entities.lock)}>
        <ha-icon .icon=${'mdi:information-outline'}></ha-icon>Details
      </button>` : nothing}
    </div>`;
  }

  private chargingRow(car: ResolvedCar) {
    const connection = this.entity(car.entities.charging_connection);
    const status = this.entity(car.entities.charging_status);
    const power = this.entity(car.entities.charging_power);
    const condition = this.entity(car.entities.charging_power_status);
    const time = this.entity(car.entities.charging_time);
    const target = numeric(this.entity(car.entities.charging_target));
    if (!available(connection)) {
      return html`<div class="row"><span class="row-icon"><ha-icon .icon=${'mdi:ev-station'}></ha-icon></span>
        <span class="row-text"><span class="row-title">Charging</span>
        <span class="row-sub">The charge state is unavailable right now.</span></span></div>`;
    }
    const connected = connection!.state === 'connected';
    if (!connected) {
      return html`<div class="row" role="button" tabindex="0" @click=${() => this.moreInfo(car.entities.charging_connection)}>
        <span class="row-icon ok"><ha-icon .icon=${'mdi:power-plug-off-outline'}></ha-icon></span>
        <span class="row-text"><span class="row-title">Not plugged in</span>
        <span class="row-sub">${target !== undefined ? `Charges to ${Math.round(target)}% when connected.` : 'Inductive or cable charging starts when you plug in.'}</span></span></div>`;
    }
    // Only judge the power condition while the car is actually plugged in: an
    // unplugged car reports no_power_available, which is not a fault.
    const problem = available(condition) && !POWER_STATUS_OK.has(condition!.state) ? condition!.state : undefined;
    const alert = problem === 'fault';
    const watts = numeric(power) ?? 0;
    const minutes = numeric(time) ?? 0;
    const chargeState = available(status) ? CHARGING_LABELS[status!.state] ?? humanize(status!.state) : 'Connected';
    const detail = [
      watts > 0 ? `${(watts / 1000).toFixed(watts >= 100000 ? 0 : 1)} kW` : '',
      minutes > 0 ? `${minutes >= 60 ? `${Math.floor(minutes / 60)} h ${Math.round(minutes % 60)} min` : `${Math.round(minutes)} min`} to ${target !== undefined ? `${Math.round(target)}%` : 'target'}` : '',
      target !== undefined && minutes <= 0 ? `Target ${Math.round(target)}%` : '',
    ].filter(Boolean).join(' · ');
    return html`
      <div class="row" role="button" tabindex="0" @click=${() => this.moreInfo(car.entities.charging_connection)}>
        <span class="row-icon ${alert ? 'alert' : problem ? 'warn' : 'ok'}"><ha-icon .icon=${alert ? 'mdi:alert-circle-outline' : problem ? 'mdi:alert-outline' : 'mdi:ev-station'}></ha-icon></span>
        <span class="row-text">
          <span class="row-title">${alert || problem ? humanize(problem) : chargeState}</span>
          <span class="row-sub">${alert
            ? 'The charger reported a fault. Check the cable and the charging station.'
            : problem === 'no_power_available'
              ? 'Plugged in, but the charging station is not supplying power.'
              : detail || 'Plugged in.'}</span>
        </span>
        ${!alert && !problem && available(status) && status!.state !== 'idle'
          ? html`<span class="pill charging"><ha-icon .icon=${'mdi:battery-charging'}></ha-icon>${chargeState}</span>`
          : nothing}
      </div>`;
  }

  private openingsRow(car: ResolvedCar) {
    const open = car.openings
      .map(item => ({ ...item, state: this.entity(item.entity) }))
      .filter(item => item.state?.state === 'on');
    if (!open.length) {
      return html`<div class="row"><span class="row-icon ok"><ha-icon .icon=${'mdi:check-circle-outline'}></ha-icon></span>
        <span class="row-text"><span class="row-title">All closed</span>
        <span class="row-sub">Doors, windows and the charge port are shut.</span></span></div>`;
    }
    return html`<div class="section">
      <div class="section-heading"><h3>Open</h3><span class="hint">${open.length === 1 ? '1 opening' : `${open.length} openings`}</span></div>
      <ul class="list">${open.map(item => html`<li class="item ${item.key === 'tank_lid' ? 'charge' : ''}" role="button" tabindex="0"
          @click=${() => this.moreInfo(item.entity)}
          @keydown=${(event: KeyboardEvent) => { if (event.key === 'Enter') this.moreInfo(item.entity); }}>
        <ha-icon .icon=${item.icon}></ha-icon><span>${item.label}${item.key === 'tank_lid' ? ' — charge port open' : ' open'}</span></li>`)}</ul>
    </div>`;
  }

  private actionsRow(car: ResolvedCar) {
    const usable = car.actions.filter(action => pressable(this.entity(action.entity)));
    if (!usable.length) return nothing;
    return html`<div class="section">
      <div class="section-heading"><h3>Quick actions</h3></div>
      <div class="actions">${usable.map(action => html`<button class="action quiet" data-action=${action.key}
          ?disabled=${this.pending === action.entity}
          @click=${() => this.press(action.entity, action.label)}>
        <ha-icon .icon=${action.icon}></ha-icon>${action.label}</button>`)}</div>
    </div>`;
  }

  private odometerRow(car: ResolvedCar) {
    const odometer = this.entity(car.entities.odometer);
    if (!available(odometer)) return nothing;
    return html`<div class="row" role="button" tabindex="0" @click=${() => this.moreInfo(car.entities.odometer)}>
      <span class="row-icon"><ha-icon .icon=${'mdi:counter'}></ha-icon></span>
      <span class="row-text"><span class="row-title">${odometer!.state} ${odometer?.attributes?.unit_of_measurement ?? 'km'}</span>
      <span class="row-sub">Odometer</span></span></div>`;
  }

  protected render() {
    const car = this.car;
    if (!car) return html`<ha-card><div class="section"><div class="row-title">Choose the car</div>
      <p class="hint">Open the card settings and select the car, for example <code>ex30</code>.</p></div></ha-card>`;
    return html`<ha-card>
      <div class="root">
        ${this.renderHero(car)}
        <div class="tile-wrap">${buildGlow(undefined, 'static', false).overlay}
          <section class="surface" aria-label="Car controls">
            <div class="section">${this.renderLock(car)}
              ${this.feedback ? html`<p class="hint" role="status" aria-live="polite" style="margin-top:10px">${this.feedback}</p>` : nothing}
            </div>
          </section>
        </div>
        ${car.show.includes('charging') ? html`<div class="tile-wrap">${buildGlow(undefined, 'static', false).overlay}
          <section class="surface" aria-label="Charging">${this.chargingRow(car)}</section></div>` : nothing}
        ${car.show.includes('openings') ? html`<div class="tile-wrap">${buildGlow(undefined, 'static', false).overlay}
          <section class="surface" aria-label="Openings">${this.openingsRow(car)}</section></div>` : nothing}
        ${car.show.includes('odometer') ? html`<div class="tile-wrap">${buildGlow(undefined, 'static', false).overlay}
          <section class="surface" aria-label="Odometer">${this.odometerRow(car)}</section></div>` : nothing}
        ${car.show.includes('actions') && car.actions.length ? html`<div class="tile-wrap">${buildGlow(undefined, 'static', false).overlay}
          <section class="surface" aria-label="Quick actions">${this.actionsRow(car)}</section></div>` : nothing}
      </div>
    </ha-card>`;
  }
}

const cardWindow = window as typeof window & { customCards?: Array<Record<string, unknown>> };
cardWindow.customCards = cardWindow.customCards || [];
cardWindow.customCards.push({
  type: 'volvo-cars-card',
  name: 'Volvo Cars Card',
  description: 'Battery, range, lock, openings and charging for one Volvo, in the Space Hub style.',
  preview: true,
});
console.info('%c VOLVO CARS CARD %c 0.1.0 ', 'background:#8fb4ff;color:#181a27;font-weight:700', 'background:#292b3e;color:#dedff5');

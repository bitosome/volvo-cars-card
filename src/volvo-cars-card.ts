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
  @state() private expanded = false;
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
    this.expanded = false;
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
          <span class="row-title">${alert ? 'Charging fault' : problem ? 'No power available' : chargeState}</span>
          <span class="row-sub">${alert
            ? 'The car reports a charging fault — check the cable and the charging station.'
            : problem === 'no_power_available'
              ? 'The car reports no power available at the charging station.'
              : detail || 'Plugged in.'}</span>
        </span>
        ${!alert && !problem && available(status) && status!.state !== 'idle'
          ? html`<span class="pill charging"><ha-icon .icon=${'mdi:battery-charging'}></ha-icon>${chargeState}</span>`
          : nothing}
      </div>`;
  }

  private openingsRow(car: ResolvedCar) {
    const plugged = this.isPlugged(car);
    const open = this.openItems(car, plugged);
    const note = this.portNote(car, plugged);
    const noteRow = note ? html`<div class="row" role="button" tabindex="0" @click=${() => this.moreInfo(`binary_sensor.${car.prefix}tank_lid`)}>
      <span class="row-icon warn"><ha-icon .icon=${'mdi:help-circle-outline'}></ha-icon></span>
      <span class="row-text"><span class="row-title">Charge port</span><span class="row-sub">${note}</span></span></div>` : nothing;
    if (!open.length) {
      return html`<div class="row"><span class="row-icon ok"><ha-icon .icon=${'mdi:check-circle-outline'}></ha-icon></span>
        <span class="row-text"><span class="row-title">All closed</span>
        <span class="row-sub">${plugged ? 'Doors and windows are shut.' : 'Doors, windows and the charge port are shut.'}</span></span></div>${noteRow}`;
    }
    return html`<div class="section">
      <div class="section-heading"><h3>Open</h3><span class="hint">${open.length === 1 ? '1 opening' : `${open.length} openings`}</span></div>
      <ul class="list">${open.map(item => html`<li class="item ${item.key === 'tank_lid' ? 'charge' : ''}" role="button" tabindex="0"
          @click=${() => this.moreInfo(item.entity)}
          @keydown=${(event: KeyboardEvent) => { if (event.key === 'Enter') this.moreInfo(item.entity); }}>
        <ha-icon .icon=${item.icon}></ha-icon><span>${item.label}${item.key === 'tank_lid' ? ' — charge port open' : ' open'}</span></li>`)}</ul>
      ${noteRow}
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

  private renderFull(car: ResolvedCar) {
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

  private openItems(car: ResolvedCar, plugged: boolean) {
    return car.openings
      .map(item => ({ ...item, state: this.entity(item.entity) }))
      .filter(item => !(plugged && item.key === 'tank_lid'))
      .filter(item => item.state?.state === 'on');
  }

  /** True while the cable is in, when the charge port is open by definition. */
  private isPlugged(car: ResolvedCar) { return this.entity(car.entities.charging_connection)?.state === 'connected'; }

  /**
   * The charge-port sensor often lags a plug event: it can report closed on a car with
   * a cable in. That contradiction belongs in the detail tile — never a claim that the
   * port is shut, and never a fault.
   */
  private portNote(car: ResolvedCar, plugged: boolean): string | undefined {
    if (!plugged) return undefined;
    const port = this.entity(`binary_sensor.${car.prefix}tank_lid`);
    if (!port || !available(port) || !['off', 'closed'].includes(port.state)) return undefined;
    return 'Charge port sensor reports closed while a cable is connected.';
  }

  /**
   * Everything the chips and the single line are derived from, shared by the banner and
   * the compact row so both layouts can never disagree about the car's state.
   */
  private signals(car: ResolvedCar) {
    const connection = this.entity(car.entities.charging_connection);
    const condition = this.entity(car.entities.charging_power_status);
    const status = this.entity(car.entities.charging_status);
    const plugged = connection?.state === 'connected';
    const watts = numeric(this.entity(car.entities.charging_power)) ?? 0;
    const minutes = numeric(this.entity(car.entities.charging_time)) ?? 0;
    const charging = plugged && status?.state === 'charging';
    const problem = plugged && available(condition) && !POWER_STATUS_OK.has(condition!.state) ? condition!.state : undefined;
    const open = this.openItems(car, plugged);
    const chips = [
      plugged ? { icon: charging ? 'mdi:battery-charging' : 'mdi:power-plug', label: watts > 0 ? `${(watts / 1000).toFixed(watts >= 100000 ? 0 : 1)} kW` : charging ? 'Charging' : 'Plugged', cls: charging ? 'charging' : '' } : undefined,
      // An opening is informational: amber, never the fault treatment.
      open.length ? { icon: open.length === 1 ? open[0].icon : 'mdi:car-door', label: open.length === 1 ? `${open[0].label} open` : `${open.length} open`, cls: 'warn' } : undefined,
      problem === 'fault' ? { icon: 'mdi:alert-circle-outline', label: 'Charging fault', cls: 'alert' } : undefined,
      problem && problem !== 'fault' ? { icon: 'mdi:alert-outline', label: 'No power', cls: 'warn' } : undefined,
    ].filter((chip): chip is { icon: string; label: string; cls: string } => !!chip);
    const line = problem
      ? { text: problem === 'fault'
            ? 'The car reports a charging fault — check the cable and the charging station.'
            : 'The car reports no power available at the charging station.', cls: problem === 'fault' ? 'alert' : 'warn' }
      : open.length > 1
        // One opening is already named on its chip; only several need this line.
        ? { text: `${open.slice(0, 3).map(item => item.key === 'tank_lid' ? 'charge port' : item.label.toLowerCase()).join(', ')} open${open.length > 3 ? ` and ${open.length - 3} more` : ''}.`, cls: 'warn' }
        : charging && minutes > 0
          ? { text: `${minutes >= 60 ? `${Math.floor(minutes / 60)} h ${Math.round(minutes % 60)} min` : `${Math.round(minutes)} min`} to ${numeric(this.entity(car.entities.charging_target)) !== undefined ? `${Math.round(numeric(this.entity(car.entities.charging_target))!)}%` : 'target'}${watts > 0 ? ` at ${(watts / 1000).toFixed(watts >= 100000 ? 0 : 1)} kW` : ''}.`, cls: '' }
          : undefined;
    return { plugged, watts, minutes, charging, problem, open, chips, line };
  }

  /** The canonical amber/red pulse for a signal line. */
  private pulseFor(line?: { cls: string }) {
    return line?.cls === 'alert' ? { weak: 'rgba(229,57,53,.30)', strong: 'rgba(229,57,53,.55)' }
      : line?.cls === 'warn' ? { weak: 'rgba(255,152,0,.28)', strong: 'rgba(255,152,0,.50)' }
        : undefined;
  }

  private chipList(chips: Array<{ icon: string; label: string; cls: string }>) {
    return html`<div class="chips">${chips.map(chip => html`<span class="chip ${chip.cls}"><ha-icon .icon=${chip.icon}></ha-icon>${chip.label}</span>`)}</div>`;
  }

  /**
   * One dense status line: thumbnail, identity with the battery figure, only the
   * chips that carry information, and the lock. Anything abnormal adds at most one
   * quiet line; every detail row stays behind the disclosure.
   */
  private renderCompact(car: ResolvedCar) {
    const lock = this.entity(car.entities.lock);
    const battery = numeric(this.entity(car.entities.battery));
    const range = this.entity(car.entities.range);
    const target = numeric(this.entity(car.entities.charging_target));
    const { chips, line } = this.signals(car);
    const image = hassUrl(this.hass, car.image ?? '');
    const unlocked = lock?.state === 'unlocked';
    const jammed = !!lock && available(lock) && !['locked', 'unlocked', 'locking', 'unlocking'].includes(lock.state);
    const busy = this.pending === car.entities.lock;
    const lockLabel = !pressable(lock) ? 'Lock unavailable' : busy ? (lock?.state === 'locked' ? 'Unlocking' : 'Locking') : lock?.state === 'locked' ? 'Unlock' : 'Lock';
    // Amber for an opening, red only for what the car itself reports. The pulse
    // colours ride on the canonical under-tile glow layer.
    const glow = buildGlow(this.pulseFor(line), 'static', !!line);
    return html`<ha-card>
      <div class="root">
        <div class="tile-wrap">
          <div class="glow-under" style=${glow.style}>${glow.overlay}</div>
          <section class="surface compact" aria-label=${`${car.name} status`}>
            <button class="thumb" data-action="thumb" style=${`--thumb-w:${car.thumb.width}px;--thumb-h:${car.thumb.height}px`} aria-label=${`Show ${car.name} location`} @click=${() => this.moreInfo(car.imageEntity)}>
              ${image ? html`<img src=${image} alt="" referrerpolicy="no-referrer" />` : html`<ha-icon .icon=${'mdi:car'}></ha-icon>`}
            </button>
            <button class="compact-identity" data-action="identity" aria-label=${`${car.name} battery ${battery ?? 'unavailable'} percent`} @click=${() => this.moreInfo(car.entities.battery)}>
              <span class="name">${car.name}</span>
              <span class="compact-figures">
                <span class="compact-value">${battery === undefined ? '—' : Math.round(battery)}<span class="figure-unit">%</span></span>
                <span class="compact-range">${available(range) ? `${range!.state} ${range?.attributes?.unit_of_measurement ?? 'km'}` : ''}</span>
              </span>
              <span class="compact-level" role="img" aria-label=${`Battery level ${battery ?? 'unknown'} percent`}>
                <span style=${`width:${Math.min(100, Math.max(0, battery ?? 0))}%`}></span>
                ${target !== undefined ? html`<span class="compact-level target" style=${`left:${Math.min(100, Math.max(0, target))}%`}></span>` : nothing}
              </span>
            </button>
            <div class="compact-controls">
              <button class="lock-pill ${unlocked ? 'unlocked' : jammed ? 'alert' : ''}" data-action="lock"
                      ?disabled=${!pressable(lock) || busy} aria-label=${lockLabel}
                      @click=${() => lock && this.lockAction(car, lock)}>
                <ha-icon .icon=${busy ? 'mdi:progress-clock' : jammed ? 'mdi:lock-alert' : lock?.state === 'locked' ? 'mdi:lock' : 'mdi:lock-open-variant'}></ha-icon>
                <span class="sr-only">${lockLabel}</span>
              </button>
              ${this.showRows(car).length ? html`<button class="disclosure" data-action="disclosure" aria-expanded=${this.expanded ? 'true' : 'false'}
                      aria-label=${this.expanded ? 'Hide details' : 'Show details'} @click=${() => { this.expanded = !this.expanded; }}>
                <ha-icon .icon=${'mdi:chevron-down'}></ha-icon><span class="sr-only">Details</span></button>` : nothing}
            </div>
            ${chips.length ? this.chipList(chips) : nothing}
            ${line ? html`<p class="alert-line ${line.cls}" role="status">${line.text}</p>` : nothing}
          </section>
        </div>
        ${this.expanded ? html`<div class="tile-wrap">${buildGlow(undefined, 'static', false).overlay}
          <section class="surface details" aria-label="Car details">${this.showRows(car)}</section></div>` : nothing}
      </div>
    </ha-card>`;
  }

  /**
   * The banner: the picture leads at full width, with only the essentials on a scrim so
   * they stay legible on any photograph. Everything else stays behind the chevron.
   */
  private renderBanner(car: ResolvedCar) {
    const lock = this.entity(car.entities.lock);
    const battery = numeric(this.entity(car.entities.battery));
    const range = this.entity(car.entities.range);
    const target = numeric(this.entity(car.entities.charging_target));
    const { chips, line } = this.signals(car);
    const image = hassUrl(this.hass, car.image ?? '');
    const unlocked = lock?.state === 'unlocked';
    const jammed = !!lock && available(lock) && !['locked', 'unlocked', 'locking', 'unlocking'].includes(lock.state);
    const busy = this.pending === car.entities.lock;
    const lockLabel = !pressable(lock) ? 'Lock unavailable' : busy ? (lock?.state === 'locked' ? 'Unlocking' : 'Locking') : lock?.state === 'locked' ? 'Unlock' : 'Lock';
    const glow = buildGlow(this.pulseFor(line), 'static', !!line);
    return html`<ha-card>
      <div class="root">
        <div class="tile-wrap">
          <div class="glow-under" style=${glow.style}>${glow.overlay}</div>
          <section class="surface banner" aria-label=${`${car.name} status`}>
            <div class="banner-media ${image ? '' : 'empty'}" style=${`--banner-h:${car.bannerHeight}px`}>
              ${image ? html`<img src=${image} alt="" referrerpolicy="no-referrer" />` : nothing}
              <div class="banner-scrim">
                <div class="banner-top">
                  <button class="compact-identity" data-action="identity" aria-label=${`${car.name} battery ${battery ?? 'unavailable'} percent`} @click=${() => this.moreInfo(car.entities.battery)}>
                    <span class="eyebrow">Volvo</span>
                    <span class="name">${car.name}</span>
                  </button>
                  <div class="compact-controls">
                    <button class="lock-pill ${unlocked ? 'unlocked' : jammed ? 'alert' : ''}" data-action="lock"
                            ?disabled=${!pressable(lock) || busy} aria-label=${lockLabel}
                            @click=${() => lock && this.lockAction(car, lock)}>
                      <ha-icon .icon=${busy ? 'mdi:progress-clock' : jammed ? 'mdi:lock-alert' : lock?.state === 'locked' ? 'mdi:lock' : 'mdi:lock-open-variant'}></ha-icon>
                      <span class="sr-only">${lockLabel}</span>
                    </button>
                    ${this.showRows(car).length ? html`<button class="disclosure" data-action="disclosure" aria-expanded=${this.expanded ? 'true' : 'false'}
                            aria-label=${this.expanded ? 'Hide details' : 'Show details'} @click=${() => { this.expanded = !this.expanded; }}>
                      <ha-icon .icon=${'mdi:chevron-down'}></ha-icon><span class="sr-only">Details</span></button>` : nothing}
                  </div>
                </div>
                <div class="banner-bottom">
                  <div class="banner-figures">
                    <span class="banner-value">${battery === undefined ? '—' : Math.round(battery)}<span class="figure-unit">%</span></span>
                    <span class="banner-range">${available(range) ? `${range!.state} ${range?.attributes?.unit_of_measurement ?? 'km'}` : ''}</span>
                  </div>
                  <span class="banner-level" role="img" aria-label=${`Battery level ${battery ?? 'unknown'} percent`}>
                    <span style=${`width:${Math.min(100, Math.max(0, battery ?? 0))}%`}></span>
                    ${target !== undefined ? html`<span class="banner-level target" style=${`left:${Math.min(100, Math.max(0, target))}%`}></span>` : nothing}
                  </span>
                  ${chips.length ? this.chipList(chips) : nothing}
                  ${line ? html`<p class="banner-note ${line.cls}" role="status">${line.text}</p>` : nothing}
                </div>
              </div>
            </div>
          </section>
        </div>
        ${this.expanded ? html`<div class="tile-wrap">${buildGlow(undefined, 'static', false).overlay}
          <section class="surface details" aria-label="Car details">${this.showRows(car)}</section></div>` : nothing}
      </div>
    </ha-card>`;
  }

  /** The rows a disclosure shows, in the order the config asks for. */
  private showRows(car: ResolvedCar) {
    return [
      car.show.includes('charging') ? this.chargingRow(car) : nothing,
      car.show.includes('openings') ? this.openingsRow(car) : nothing,
      car.show.includes('odometer') ? this.odometerRow(car) : nothing,
      car.show.includes('actions') && car.actions.length ? this.actionsRow(car) : nothing,
    ].filter(row => row !== nothing);
  }

  protected render() {
    const car = this.car;
    if (!car) return html`<ha-card><div class="section"><div class="row-title">Choose the car</div>
      <p class="hint">Open the card settings and select the car, for example <code>ex30</code>.</p></div></ha-card>`;
    return car.layout === 'full' ? this.renderFull(car)
      : car.layout === 'compact' ? this.renderCompact(car)
        : this.renderBanner(car);
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
console.info('%c VOLVO CARS CARD %c 0.4.0 ', 'background:#8fb4ff;color:#181a27;font-weight:700', 'background:#292b3e;color:#dedff5');

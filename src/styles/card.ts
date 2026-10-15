import { css } from 'lit';

/**
 * Per-card styling on top of the shared design tokens. The tile surfaces, radii,
 * shadows, typography and accent glow come from `shared/design-tokens.ts`; this
 * file only lays out this card's own hero, rows and actions.
 */
export const cardStyles = css`
  :host {
    container-type: inline-size;
    --car-accent: var(--accent-color, #8fb4ff);
    --car-surface: var(--ha-card-background, var(--card-background-color, #292b3e));
    --car-muted: var(--secondary-text-color, #acb1cc);
    color: var(--primary-text-color, #dedff5);
    font-family: var(--paper-font-body1_-_font-family, inherit);
  }
  * { box-sizing: border-box; }
  ha-card { display: block; padding: var(--tile-padding-large); border-radius: var(--ha-card-border-radius, 24px); background: var(--car-surface); border: 1px solid var(--divider-color, rgba(255,255,255,.05)); overflow: visible; }
  .root { display: grid; gap: var(--large-gap); isolation: isolate; }
  .tile-wrap { position: relative; min-width: 0; }
  .surface { position: relative; z-index: 1; border-radius: var(--tile-border-radius); background: color-mix(in srgb,var(--car-surface) 96%,var(--primary-text-color) 4%); box-shadow: var(--tile-shadow-default); }
  .glow-under { position: absolute; inset: 0; pointer-events: none; z-index: 0; border-radius: var(--tile-border-radius); }
  .glow-overlay { position: absolute; inset: -10px -14px -18px; border-radius: inherit; pointer-events: none; mix-blend-mode: screen; opacity: .9; mask-image: linear-gradient(180deg, transparent 0%,rgba(0,0,0,.25) 18px,rgba(0,0,0,.9) 44px,#000 100%); }
  @keyframes glowPulse { 0%,100% { box-shadow: 0 12px 28px var(--pulse-weak),0 4px 14px var(--pulse-weak); } 50% { box-shadow: 0 18px 40px var(--pulse-strong),0 6px 18px var(--pulse-weak); } }
  @media (prefers-reduced-motion: reduce) { .pulse, .glow-overlay { animation: none !important; } .progress > span { transition: none; } }
  button { font: inherit; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  button:disabled { cursor: default; opacity: .46; }
  button:focus-visible, summary:focus-visible, [role="button"]:focus-visible { outline: 3px solid var(--car-accent); outline-offset: 3px; }
  ha-icon { width: 22px; height: 22px; --mdc-icon-size: 22px; flex: 0 0 22px; display: inline-flex; }

  /* Hero: the car itself, then the two figures that matter. */
  .hero { padding: 0; overflow: hidden; }
  .hero-media { position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; background: color-mix(in srgb,var(--primary-text-color) 5%,transparent); }
  .hero-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
  /* Without a picture the hero is a compact identity band, not an empty frame. */
  .hero-media.empty { aspect-ratio: auto; min-height: 96px; display: flex; align-items: flex-end; }
  .hero-scrim { position: absolute; inset: auto 0 0; padding: 14px clamp(14px,4cqw,20px); background: linear-gradient(180deg, transparent, rgba(0,0,0,.55) 60%); }
  .identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .car-badge { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: color-mix(in srgb,var(--car-accent) 18%,transparent); color: #fff; flex: 0 0 40px; }
  .car-badge ha-icon { width: 24px; height: 24px; --mdc-icon-size: 24px; flex-basis: 24px; }
  .identity-text { flex: 1; min-width: 0; }
  .eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .02em; color: var(--car-muted); text-transform: uppercase; }
  .hero .eyebrow { color: rgba(255,255,255,.75); }
  .name { font-size: 18px; font-weight: 650; letter-spacing: -.015em; margin-top: 2px; overflow-wrap: anywhere; }
  .hero .name { color: #fff; text-shadow: 0 1px 12px rgba(0,0,0,.45); }
  .figures { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; padding: 16px clamp(14px,4cqw,20px) 4px; }
  .figure { display: flex; align-items: baseline; gap: 3px; min-width: 0; }
  .figure-value { font-size: clamp(30px,9cqw,38px); font-weight: 680; letter-spacing: -.03em; font-variant-numeric: tabular-nums; line-height: 1; }
  .figure-unit { font-size: 15px; font-weight: 600; color: var(--car-muted); }
  .figure-caption { font-size: 11px; color: var(--car-muted); margin-top: 6px; }
  .figure.secondary { text-align: right; }
  .figure.secondary .figure-value { font-size: clamp(19px,5cqw,22px); }
  .level { position: relative; height: 5px; margin: 12px clamp(14px,4cqw,20px) 0; border-radius: 999px; overflow: hidden; background: color-mix(in srgb,var(--primary-text-color) 12%,transparent); }
  .level > span { display: block; height: 100%; border-radius: inherit; background: var(--car-accent); transition: width .3s; }
  /* The charge-target marker: never inherits the track's width, radius or background. */
  .level-mark { position: absolute; top: 0; bottom: 0; left: 0; width: 2px; min-width: 0; max-width: none; height: auto; border-radius: 0; background: color-mix(in srgb,var(--primary-text-color) 60%,transparent); flex: none; }
  .banner-media ~ .banner-band .level-mark, .banner-band .level-mark { background: color-mix(in srgb,var(--primary-text-color) 60%,transparent); }
  .hero-foot { display: flex; flex-wrap: wrap; gap: var(--medium-gap); padding: 12px clamp(14px,4cqw,20px) 16px; }

  .pill { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 6px 10px; border-radius: var(--chip-border-radius); font-size: 12px; font-weight: 550; line-height: 1.35; color: var(--car-muted); background: color-mix(in srgb,var(--primary-text-color,#ddd) 6%,transparent); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .pill ha-icon { width: 16px; height: 16px; --mdc-icon-size: 16px; flex-basis: 16px; }
  .pill.live { color: color-mix(in srgb,var(--status-active-color) 65%,var(--primary-text-color) 35%); background: color-mix(in srgb,var(--status-active-color) 12%,transparent); }
  .pill.charging { color: color-mix(in srgb,var(--status-success-color) 68%,var(--primary-text-color) 32%); background: color-mix(in srgb,var(--status-success-color) 12%,transparent); }
  .pill.warn { color: color-mix(in srgb,var(--status-warn-color) 72%,var(--primary-text-color) 28%); background: color-mix(in srgb,var(--status-warn-color) 14%,transparent); }
  .pill.alert { color: color-mix(in srgb,var(--status-alert-color) 74%,var(--primary-text-color) 26%); background: color-mix(in srgb,var(--status-alert-color) 14%,transparent); }
  .pill.unlocked { color: color-mix(in srgb,var(--switch-lock-unlocked-color,#e53935) 72%,var(--primary-text-color) 28%); background: color-mix(in srgb,var(--switch-lock-unlocked-color,#e53935) 14%,transparent); }

  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .action { border: 0; border-radius: 999px; min-height: 46px; display: flex; justify-content: center; align-items: center; gap: 8px; padding: 10px 16px; font-size: 14px; font-weight: 650; line-height: 1.3; background: color-mix(in srgb,var(--primary-text-color) 8%,transparent); }
  .action.primary { flex: 1; color: var(--primary-background-color,#181a27); background: var(--car-accent); }
  .action.secondary { color: var(--car-muted); }
  .action.quiet { color: var(--car-muted); background: transparent; border: 1px solid var(--divider-color, rgba(255,255,255,.12)); }
  .action.block { flex: 1; }

  .row { display: flex; align-items: center; gap: 12px; padding: 14px clamp(14px,4cqw,20px); min-width: 0; }
  .row + .row { border-top: 1px solid var(--divider-color, rgba(255,255,255,.06)); }
  .row-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: color-mix(in srgb,var(--primary-text-color) 7%,transparent); color: var(--car-muted); flex: 0 0 34px; }
  .row-icon ha-icon { width: 20px; height: 20px; --mdc-icon-size: 20px; flex-basis: 20px; }
  .row-icon.alert { color: var(--status-alert-color); background: color-mix(in srgb,var(--status-alert-color) 14%,transparent); }
  .row-icon.warn { color: var(--status-warn-color); background: color-mix(in srgb,var(--status-warn-color) 14%,transparent); }
  .row-icon.open { color: var(--status-warn-color); background: color-mix(in srgb,var(--status-warn-color) 14%,transparent); }
  .row-icon.ok { color: var(--status-success-color); background: color-mix(in srgb,var(--status-success-color) 12%,transparent); }
  .row-text { flex: 1; min-width: 0; }
  .row-title { display: block; font-size: 14px; font-weight: 550; overflow-wrap: anywhere; }
  .row-sub { display: block; font-size: 12px; color: var(--car-muted); margin-top: 2px; overflow-wrap: anywhere; }
  .row[role="button"] { cursor: pointer; }
  .row[role="button"]:hover { background: color-mix(in srgb,var(--primary-text-color) 4%,transparent); }
  .section { padding: 14px clamp(14px,4cqw,20px); }
  .section-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 10px; margin-bottom: 10px; }
  .section-heading h3 { font-size: 13px; font-weight: 650; margin: 0; letter-spacing: -.01em; }
  .hint { font-size: 12px; color: var(--car-muted); line-height: 1.5; }
  .list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .item { display: flex; align-items: center; gap: 10px; font-size: 13px; min-width: 0; }
  .item ha-icon { width: 18px; height: 18px; --mdc-icon-size: 18px; flex-basis: 18px; color: var(--status-warn-color); }
  .item.charge ha-icon { color: var(--status-alert-color); }
  .item span { overflow-wrap: anywhere; }
  /* ---- banner layout: a clean picture over one information band ---- */
  .banner { padding: 0; overflow: hidden; }
  .banner-media { position: relative; display: block; width: 100%; height: var(--banner-h, 160px); background: color-mix(in srgb,var(--primary-text-color) 6%,transparent); }
  .banner-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
  /* Nothing is written on the car: only enough of an edge for the band to separate. */
  .banner-fade { position: absolute; inset: auto 0 0; height: 40%; background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.22) 100%); pointer-events: none; }
  .banner-band { display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 8px 6px 8px 14px; }
  .band-identity { display: grid; gap: 4px; min-width: 0; flex: 1; padding: 0; border: 0; background: transparent; text-align: left; }
  .band-name { font-size: 15px; font-weight: 600; letter-spacing: -.015em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .band-figures { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .band-value { font-size: 21px; font-weight: 680; letter-spacing: -.03em; line-height: 1; font-variant-numeric: tabular-nums; flex: 0 0 auto; }
  .band-value .figure-unit { font-size: 12px; }
  .band-level { position: relative; flex: 1 1 60px; min-width: 48px; max-width: 200px; height: 3px; border-radius: 999px; background: color-mix(in srgb,var(--primary-text-color) 13%,transparent); }
  .band-level > span { display: block; height: 100%; border-radius: inherit; background: var(--car-accent); transition: width .3s; }
  .band-range { font-size: 12px; color: var(--car-muted); font-variant-numeric: tabular-nums; white-space: nowrap; flex: 0 0 auto; }
  .band-status { display: inline-flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: var(--chip-border-radius); font-size: 11.5px; font-weight: 600; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%; color: var(--car-muted); background: color-mix(in srgb,var(--primary-text-color,#ddd) 7%,transparent); }
  .band-status ha-icon { width: 14px; height: 14px; --mdc-icon-size: 14px; flex-basis: 14px; }
  .band-status.warn { color: color-mix(in srgb,var(--status-warn-color) 74%,var(--primary-text-color) 26%); background: color-mix(in srgb,var(--status-warn-color) 15%,transparent); }
  .band-status.alert { color: color-mix(in srgb,var(--status-alert-color) 76%,var(--primary-text-color) 24%); background: color-mix(in srgb,var(--status-alert-color) 15%,transparent); }
  /* Light controls: no ring, a generous hit area. */
  .banner-band .lock-pill, .banner-band .disclosure { width: 40px; height: 40px; border: 0; background: transparent; color: var(--car-muted); }
  .banner-band .lock-pill:hover, .banner-band .disclosure:hover { background: color-mix(in srgb,var(--primary-text-color) 7%,transparent); }
  .banner-band .lock-pill { color: var(--primary-text-color); }
  .banner-band .lock-pill.unlocked { color: color-mix(in srgb,var(--switch-lock-unlocked-color,#e53935) 80%,var(--primary-text-color) 20%); }
  .banner-band .lock-pill.alert { color: var(--status-alert-color); }
  .banner-line { margin: 0; padding: 0 14px 9px; font-size: 12px; line-height: 1.45; color: var(--car-muted); overflow-wrap: anywhere; }
  .banner-line.warn { color: color-mix(in srgb,var(--status-warn-color) 76%,var(--primary-text-color) 24%); }
  .banner-line.alert { color: color-mix(in srgb,var(--status-alert-color) 78%,var(--primary-text-color) 22%); }

  /* ---- compact layout: one dense status row ---- */
  /* Thumbnail, identity and controls share the first line; chips get a full-width
     line of their own so neither the car's name nor a chip label is ever clipped. */
  .compact { display: grid; grid-template-columns: auto minmax(120px,1fr) auto; align-items: center; column-gap: 10px; row-gap: 4px; padding: 10px 12px; }
  .thumb { padding: 0; border: 0; width: var(--thumb-w, 128px); height: var(--thumb-h, 72px); border-radius: calc(var(--tile-border-radius) - 4px); overflow: hidden; background: color-mix(in srgb,var(--primary-text-color) 6%,transparent); display: grid; place-items: center; color: var(--car-muted); flex: 0 0 auto; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb ha-icon { width: 26px; height: 26px; --mdc-icon-size: 26px; flex-basis: 26px; }
  .compact-identity { display: grid; gap: 3px; min-width: 0; text-align: left; padding: 0; border: 0; background: transparent; }
  .compact-identity .name { font-size: 13px; font-weight: 600; letter-spacing: -.01em; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .compact-figures { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
  .compact-value { font-size: 21px; font-weight: 680; letter-spacing: -.03em; font-variant-numeric: tabular-nums; line-height: 1; }
  .compact-value .figure-unit { font-size: 12px; }
  .compact-range { font-size: 12px; color: var(--car-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .compact-level { position: relative; height: 3px; width: min(140px, 100%); border-radius: 999px; overflow: hidden; background: color-mix(in srgb,var(--primary-text-color) 12%,transparent); }
  .compact-level > span { display: block; height: 100%; border-radius: inherit; background: var(--car-accent); transition: width .3s; }
  .chips { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 5px; min-width: 0; }
  .chip { display: inline-flex; align-items: center; gap: 3px; padding: 3px 7px; border-radius: var(--chip-border-radius); font-size: 11px; font-weight: 600; line-height: 1.2; color: var(--car-muted); background: color-mix(in srgb,var(--primary-text-color,#ddd) 7%,transparent); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .chip ha-icon { width: 13px; height: 13px; --mdc-icon-size: 13px; flex-basis: 13px; }
  .chip.charging { color: color-mix(in srgb,var(--status-success-color) 68%,var(--primary-text-color) 32%); background: color-mix(in srgb,var(--status-success-color) 13%,transparent); }
  .chip.warn { color: color-mix(in srgb,var(--status-warn-color) 72%,var(--primary-text-color) 28%); background: color-mix(in srgb,var(--status-warn-color) 15%,transparent); }
  .chip.alert { color: color-mix(in srgb,var(--status-alert-color) 74%,var(--primary-text-color) 26%); background: color-mix(in srgb,var(--status-alert-color) 15%,transparent); }
  .compact-controls { display: flex; align-items: center; gap: 6px; justify-self: end; }
  .lock-pill, .disclosure { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 1px solid var(--divider-color, rgba(255,255,255,.1)); border-radius: 999px; background: color-mix(in srgb,var(--primary-text-color) 7%,transparent); color: var(--primary-text-color); }
  .lock-pill.unlocked { color: color-mix(in srgb,var(--switch-lock-unlocked-color,#e53935) 78%,var(--primary-text-color) 22%); border-color: color-mix(in srgb,var(--switch-lock-unlocked-color,#e53935) 40%,transparent); }
  .lock-pill.alert { color: var(--status-alert-color); border-color: color-mix(in srgb,var(--status-alert-color) 40%,transparent); }
  .lock-pill ha-icon, .disclosure ha-icon { width: 20px; height: 20px; --mdc-icon-size: 20px; flex-basis: 20px; }
  .disclosure ha-icon { transition: transform .2s; }
  .disclosure[aria-expanded="true"] ha-icon { transform: rotate(180deg); }
  .alert-line { grid-column: 1 / -1; margin: 2px 0 0; font-size: 12px; line-height: 1.45; color: var(--car-muted); overflow-wrap: anywhere; }
  .alert-line.warn { color: color-mix(in srgb,var(--status-warn-color) 74%,var(--primary-text-color) 26%); }
  .alert-line.alert { color: color-mix(in srgb,var(--status-alert-color) 76%,var(--primary-text-color) 24%); }
  .details { margin-top: var(--medium-gap); }
  /* Narrow columns put the chips on their own line instead of squeezing the name. */
  @container (max-width: 430px) { .compact { grid-template-columns: auto minmax(0,1fr) auto; } }
  @container (max-width: 340px) { .thumb { width: calc(var(--thumb-w, 128px) * .78); height: calc(var(--thumb-h, 72px) * .78); } .compact-value { font-size: 19px; } }
  .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
`;

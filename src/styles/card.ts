import { css } from 'lit';
export const cardStyles = css`
  :host {
    --car-accent: var(--accent-color, #bba3f2);
    --car-surface: var(
      --ha-card-background,
      var(--card-background-color, #292b3e)
    );
    --car-muted: var(--secondary-text-color, #acb1cc);
    color: var(--primary-text-color, #dedff5);
    font-family: var(--paper-font-body1_-_font-family, inherit);
  }
  * {
    box-sizing: border-box;
  }
  .outer {
    container-type: inline-size;
  }
  ha-card {
    display: block;
    border-radius: var(--ha-card-border-radius, 24px);
    padding: var(--tile-padding-large);
    background: var(--car-surface);
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.06));
    overflow: visible;
  }
  .root {
    isolation: isolate;
  }
  .tile-wrap {
    position: relative;
    min-width: 0;
  }
  .surface {
    position: relative;
    z-index: 1;
    border-radius: var(--tile-border-radius);
    background: color-mix(
      in srgb,
      var(--car-surface) 96%,
      var(--primary-text-color) 4%
    );
    box-shadow: var(--tile-shadow-default);
  }
  .glow-under {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    border-radius: var(--tile-border-radius);
  }
  .glow-overlay {
    position: absolute;
    inset: -10px -14px -18px;
    border-radius: inherit;
    pointer-events: none;
    mix-blend-mode: screen;
    opacity: 0.9;
    mask-image: linear-gradient(
      180deg,
      transparent 0%,
      rgba(0, 0, 0, 0.25) 18px,
      rgba(0, 0, 0, 0.9) 44px,
      #000 100%
    );
  }
  @keyframes glowPulse {
    0%,
    100% {
      box-shadow:
        0 12px 28px var(--pulse-weak),
        0 4px 14px var(--pulse-weak);
    }
    50% {
      box-shadow:
        0 18px 40px var(--pulse-strong),
        0 6px 18px var(--pulse-weak);
    }
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button:focus-visible,
  summary:focus-visible {
    outline: 3px solid var(--car-accent);
    outline-offset: 3px;
  }
  ha-icon {
    display: inline-flex;
    width: 22px;
    height: 22px;
    --mdc-icon-size: 22px;
    flex: 0 0 22px;
  }
  .vehicle {
    padding: 18px 20px;
    overflow: hidden;
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  .identity {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }
  .identity h2 {
    font-size: 18px;
    font-weight: 650;
    letter-spacing: -0.02em;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .lock-state {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
    border: 0;
    border-radius: 999px;
    min-height: 44px;
    padding: 6px 9px;
    background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
    color: var(--car-muted);
    font-size: 11px;
    font-weight: 600;
  }
  .lock-state ha-icon {
    width: 16px;
    height: 16px;
    --mdc-icon-size: 16px;
    flex-basis: 16px;
  }
  .vehicle-image {
    height: var(--image-height, 160px);
    margin: 5px -6px 8px;
    display: grid;
    place-items: center;
  }
  .vehicle-image img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    min-height: 0;
    max-height: 100%;
  }
  .energy {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-top: 14px;
  }
  .battery-figure {
    display: grid;
    text-align: left;
    border: 0;
    background: transparent;
    border-radius: 10px;
    padding: 0 0 4px;
    min-height: 54px;
  }
  .battery-value {
    font-size: 44px;
    line-height: 1.05;
    font-weight: 650;
    letter-spacing: -0.05em;
    font-variant-numeric: tabular-nums;
  }
  .battery-value small {
    font-size: 21px;
    margin-left: 3px;
    font-weight: 500;
    color: var(--car-muted);
    letter-spacing: -0.02em;
  }
  .caption {
    font-size: 11px;
    line-height: 1.4;
    color: var(--car-muted);
    margin-top: 5px;
  }
  .range-figure {
    display: grid;
    text-align: right;
    padding-bottom: 4px;
    font-variant-numeric: tabular-nums;
  }
  .range-figure > span:first-child {
    font-size: 24px;
    font-weight: 550;
    letter-spacing: -0.02em;
  }
  .range-figure small {
    font-size: 13px;
    color: var(--car-muted);
    font-weight: 500;
  }
  .battery-track {
    position: relative;
    height: 6px;
    margin-top: 12px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--primary-text-color) 12%, transparent);
    overflow: hidden;
  }
  .battery-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--car-accent);
    transition: width 0.3s;
  }
  .battery-fill.active {
    background: var(--status-active-color);
  }
  .target-marker {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    transform: translateX(-1px);
    background: var(--primary-text-color);
    opacity: 0.6;
  }
  .charge-heading {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    color: var(--car-muted);
    font-size: 11px;
    margin-top: 8px;
    line-height: 1.4;
    flex-wrap: wrap;
  }
  .charge-heading > span:first-child {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .charge-heading ha-icon {
    width: 15px;
    height: 15px;
    --mdc-icon-size: 15px;
    flex-basis: 15px;
  }
  .charging-status {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    text-align: left;
    min-height: 60px;
    border: 0;
    border-radius: var(--tile-border-radius);
    background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
    padding: 11px 12px;
    margin-top: 16px;
  }
  .status-symbol {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
    color: var(--car-muted);
  }
  .status-copy {
    display: grid;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }
  .status-copy strong {
    font-size: 13px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .status-copy > span {
    font-size: 11px;
    color: var(--car-muted);
    line-height: 1.4;
  }
  .charging-status > ha-icon {
    width: 16px;
    height: 16px;
    --mdc-icon-size: 16px;
    color: var(--car-muted);
    flex-basis: 16px;
  }
  .charging-status.active {
    background: color-mix(in srgb, var(--status-active-color) 10%, transparent);
  }
  .active .status-symbol {
    color: var(--status-active-color);
  }
  .error {
    color: var(--error-color, #e97d82);
  }
  .charging-status.error {
    background: color-mix(
      in srgb,
      var(--error-color, #e97d82) 10%,
      transparent
    );
  }
  .warning {
    color: color-mix(
      in srgb,
      var(--warning-color, #e9b866) 76%,
      var(--primary-text-color)
    );
  }
  .openings {
    padding: 14px 0;
    border-bottom: 1px solid
      color-mix(in srgb, var(--primary-text-color) 8%, transparent);
  }
  .opening-summary {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--car-muted);
    line-height: 1.4;
  }
  .warning .opening-summary {
    color: inherit;
  }
  .opening-summary ha-icon {
    width: 18px;
    height: 18px;
    --mdc-icon-size: 18px;
    flex-basis: 18px;
  }
  .opening-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .opening-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    border: 0;
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--warning-color, #e9b866) 10%,
      transparent
    );
    font-size: 11px;
    font-weight: 550;
    padding: 9px 11px;
  }
  .opening-pill ha-icon {
    width: 16px;
    height: 16px;
    --mdc-icon-size: 16px;
    flex-basis: 16px;
  }
  .coverage {
    display: block;
    font-size: 11px;
    color: var(--car-muted);
    margin-top: 6px;
  }
  .controls,
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 12px;
  }
  .controls {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .controls:not(:has([data-action='climate'])) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .action {
    border: 0;
    border-radius: 999px;
    min-height: 46px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.35;
    background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .action ha-icon {
    width: 19px;
    height: 19px;
    --mdc-icon-size: 19px;
    flex-basis: 19px;
  }
  .primary {
    background: var(--car-accent);
    color: var(--primary-background-color, #181a27);
  }
  .secondary {
    color: var(--car-muted);
  }
  .icon-button {
    border: 0;
    border-radius: 50%;
    display: grid;
    place-items: center;
    min-width: 44px;
    min-height: 44px;
    padding: 8px;
    background: transparent;
  }
  .feedback {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    line-height: 1.5;
    margin-top: 12px;
    padding: 10px 12px;
    background: color-mix(in srgb, var(--primary-text-color) 5%, transparent);
    border-radius: 14px;
    overflow-wrap: anywhere;
  }
  .feedback > span {
    flex: 1;
    min-width: 0;
  }
  .feedback.success {
    color: var(--success-color, #8ac887);
  }
  .details {
    margin-top: 16px;
    border-top: 1px solid
      color-mix(in srgb, var(--primary-text-color) 8%, transparent);
  }
  .detail-section {
    padding: 16px 0;
    border-bottom: 1px solid
      color-mix(in srgb, var(--primary-text-color) 7%, transparent);
  }
  .details h3 {
    font-size: 13px;
    font-weight: 650;
    margin-bottom: 9px;
  }
  .details p,
  dialog p {
    font-size: 12px;
    color: var(--car-muted);
    line-height: 1.5;
  }
  dl {
    margin: 8px 0 0;
    font-size: 12px;
    line-height: 1.5;
  }
  dl > div {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 32px;
  }
  dt {
    color: var(--car-muted);
  }
  dd {
    margin: 0;
    text-align: right;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .text-button {
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 12px;
    min-height: 44px;
    padding: 7px 0;
    text-align: right;
  }
  .opening-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    margin-top: 10px;
  }
  .opening-item {
    display: flex;
    align-items: center;
    text-align: left;
    gap: 8px;
    border: 0;
    border-radius: 12px;
    padding: 10px;
    min-height: 52px;
    background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
    font-size: 11px;
    line-height: 1.4;
    min-width: 0;
  }
  .opening-item small {
    display: block;
    color: var(--car-muted);
    margin-top: 3px;
  }
  .opening-item ha-icon {
    width: 18px;
    height: 18px;
    --mdc-icon-size: 18px;
    flex-basis: 18px;
  }
  .detail-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: 44px;
    border: 0;
    background: transparent;
    font-size: 12px;
    padding: 12px 0;
  }
  .update-details {
    font-size: 11px;
    color: var(--car-muted);
  }
  .update-details summary {
    min-height: 44px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .update-details time {
    font-variant-numeric: tabular-nums;
  }
  dialog {
    background: var(--car-surface);
    color: var(--primary-text-color);
    border: 1px solid var(--divider-color);
    border-radius: 24px;
    padding: 22px;
    width: calc(100vw - 24px);
    max-width: 420px;
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    box-shadow: 0 24px 90px #0005;
  }
  dialog::backdrop {
    background: #070a14a3;
    backdrop-filter: blur(7px);
  }
  .dialog-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }
  .dialog-heading h3 {
    font-size: 20px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  dialog .actions > * {
    flex: 1;
  }
  dialog .feedback {
    flex-wrap: wrap;
  }
  .empty {
    padding: 20px;
    font-size: 13px;
    color: var(--car-muted);
  }
  .compact .vehicle-image {
    float: right;
    width: 42%;
    margin: 8px 0 0 12px;
  }
  .compact .energy {
    min-height: 80px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  .compact .battery-track {
    clear: both;
  }
  .compact .battery-value {
    font-size: 34px;
  }
  .compact .range-figure {
    text-align: left;
  }
  .compact .range-figure > span:first-child {
    font-size: 18px;
  }
  @container (max-width:360px) {
    .vehicle {
      padding: 14px;
    }
    .identity h2 {
      font-size: 16px;
    }
    .lock-state {
      padding: 5px 7px;
      font-size: 10px;
    }
    .vehicle-image {
      max-height: 130px;
    }
    .battery-value {
      font-size: 38px;
    }
    .controls {
      gap: 5px;
    }
    .action {
      font-size: 11px;
      padding: 9px 6px;
      gap: 4px;
    }
    .action ha-icon {
      width: 17px;
      height: 17px;
      --mdc-icon-size: 17px;
      flex-basis: 17px;
    }
    .opening-grid {
      grid-template-columns: 1fr;
    }
  }
  @media (hover: hover) {
    button:not(:disabled):hover {
      filter: brightness(1.08);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    .glow-under {
      animation: none !important;
      transition: none !important;
    }
  }
`;

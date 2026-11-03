import { css } from 'lit';
export const cardStyles = css`
  :host {
    color: var(--primary-text-color);
  }
  * {
    box-sizing: border-box;
  }
  .outer {
    container: vehicle-card / inline-size;
  }
  ha-card {
    display: block;
    border-radius: var(--ha-card-border-radius, 24px);
    padding: var(--tile-padding-large, 12px);
    background: var(--family-surface);
    border: 1px solid var(--divider-color, rgba(255, 255, 255, 0.06));
    /* Bound the halo to this dashboard card; inner tile gaps remain open. */
    overflow: clip;
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
      var(--family-surface) 96%,
      var(--primary-text-color) 4%
    );
    box-shadow: var(--tile-shadow-default);
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
    outline: 3px solid var(--primary-color);
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
    padding: 12px 16px;
    overflow: hidden;
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  .identity.family-header {
    padding: 0;
  }
  .vehicle-image {
    height: var(--image-height, 140px);
    margin: 0 -4px;
    display: grid;
    place-items: center;
    container-type: size;
  }
  .image-frame {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .image-frame.cropped {
    width: min(100cqw, calc(100cqh * var(--frame-ratio)));
    height: min(100cqh, calc(100cqw / var(--frame-ratio)));
  }
  .vehicle-image img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    min-height: 0;
    max-height: 100%;
  }
  .image-frame.cropped img {
    position: absolute;
    max-height: none;
    object-fit: fill;
  }
  .energy {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-top: 4px;
  }
  .battery-figure {
    display: grid;
    text-align: left;
    border: 0;
    background: transparent;
    border-radius: 10px;
    padding: 0 0 4px;
    min-height: 44px;
  }
  .battery-value {
    font-size: 38px;
    line-height: 1.05;
    font-weight: 600;
    letter-spacing: -0.05em;
    font-variant-numeric: tabular-nums;
  }
  .battery-value small {
    font-size: 18px;
    margin-left: 3px;
    font-weight: 500;
    color: var(--family-muted);
    letter-spacing: -0.02em;
  }
  /* Missing readings say Unavailable without a unit, at a calm label size. */
  .battery-value.family-unavailable,
  .range-figure > span.family-unavailable {
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: normal;
  }
  .caption {
    font-size: 12px;
    line-height: 1.4;
    color: var(--family-muted);
    margin-top: 3px;
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
    color: var(--family-muted);
    font-weight: 500;
  }
  /* The bar itself is the shared levelMeter(); the card only places it. */
  .battery-meter {
    margin-top: 7px;
  }
  .status-overview {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
  }
  .family-chip.charging-status,
  .family-chip.opening-pill {
    max-width: 100%;
    text-align: left;
  }
  .family-chip.charging-status.active {
    background: color-mix(in srgb, var(--family-active) 14%, var(--family-surface));
  }
  .opening-item.warning {
    color: color-mix(in srgb, var(--family-warning) 76%, var(--primary-text-color));
  }
  .openings,
  .opening-pills {
    display: contents;
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
    margin-top: 8px;
  }
  .controls:not(:has([data-action='climate'])) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .family-dialog .actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr));
    align-items: stretch;
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
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 9px;
  }
  .details p,
  dialog p {
    font-size: 13px;
    color: var(--family-muted);
    line-height: 1.5;
  }
  dl {
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.5;
  }
  dl > div {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    min-height: 44px;
  }
  dt {
    overflow-wrap: anywhere;
    color: var(--family-muted);
  }
  dd {
    margin: 0;
    text-align: right;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .family-action.diagnostic {
    max-width: 100%;
    overflow-wrap: anywhere;
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
    font-size: 13px;
    line-height: 1.4;
    min-width: 0;
  }
  .opening-item > span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .opening-item small {
    display: block;
    color: var(--family-muted);
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
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    padding: 12px 0;
  }
  .update-details {
    font-size: 11px;
    color: var(--family-muted);
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
  .details-content {
    container: vehicle-details / inline-size;
    padding-top: 0;
  }
  .family-dialog-body > p:first-child {
    margin-top: 0;
  }
  .family-dialog-body > p:last-child {
    margin-bottom: 0;
  }
  .details-dialog .details {
    margin-top: 0;
    border-top: 0;
  }
  dialog .actions > * {
    flex: 1;
  }
  .empty {
    padding: 8px 12px;
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
  .compact .battery-meter {
    clear: both;
  }
  .compact .range-figure {
    text-align: left;
  }
  .compact .range-figure > span:first-child {
    font-size: 18px;
  }
  @container vehicle-card (max-width:360px) {
    .vehicle {
      padding: 12px;
    }
    .vehicle-image {
      max-height: 130px;
    }
  }
  @container vehicle-card (max-width:420px) {
    .controls {
      gap: 6px;
    }
    /* Keep 13px shared labels readable instead of squeezing icon + text. */
    .controls .family-action {
      flex-direction: column;
      gap: 4px;
      min-height: 64px;
      padding: 8px 4px;
      overflow-wrap: normal;
    }
  }
  @container vehicle-details (max-width:340px) {
    .opening-grid {
      grid-template-columns: 1fr;
    }
    dl > div {
      gap: 8px;
    }
    .update-details dl > div {
      grid-template-columns: 1fr;
      gap: 0;
      padding-block: 6px;
    }
    .update-details dd {
      text-align: left;
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

import { buildGlow } from './shared/glow';
import { available, type EntityState } from './types';
import type { ChargingState } from './vehicle-state';

/** Domain adapter: SmartEVSE owns colors/effects; the shared library renders them. */
export function chargingGlow(charge: ChargingState, controller?: EntityState) {
  const none = () => buildGlow(undefined);
  if (!available(controller) || charge.connection === 'unknown') return none();
  const key = charge.tone === 'error' ? 'error' : charge.connection === 'disconnected'
    ? 'off' : charge.active ? 'charging' : 'idle';
  // SmartEVSE leaves disconnected chargers neutral, without an activation halo.
  if (key === 'off') return none();
  const visual = controller?.attributes.wled_visuals?.[key];
  if (!visual || !Array.isArray(visual.color) || visual.color.length !== 3 ||
      !visual.color.every((n: unknown) => typeof n === 'number' && Number.isFinite(n))) return none();
  const byte = (n: number) => Math.min(255, Math.max(0, n));
  const rgb = visual.color.map(byte).join(', ');
  const number = (key: string) => typeof visual[key] === 'number' && Number.isFinite(visual[key]) ? byte(visual[key]) : 0;
  const weak = (0.08 + number('ix') / 255 * 0.16).toFixed(3);
  const strong = (0.16 + number('ix') / 255 * 0.24).toFixed(3);
  const pulse = number('fx') !== 0;
  const glow = buildGlow({ weak: `rgba(${rgb}, ${weak})`, strong: `rgba(${rgb}, ${strong})` }, pulse ? 'pulse' : 'static', true);
  if (pulse) glow.style += ` animation-duration: ${Math.max(0.8, 3.2 - number('sx') / 255 * 2.4).toFixed(2)}s;`;
  return glow;
}

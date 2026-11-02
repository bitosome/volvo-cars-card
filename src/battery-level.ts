/**
 * Battery level bands shared by the overview meter.
 * 60 % and above is healthy (green), 20-59 % is a warning (yellow) and below 20 % is low (red).
 */
export type BatteryLevel = 'high' | 'medium' | 'low';

export const BATTERY_HIGH_FROM = 60;
export const BATTERY_LOW_BELOW = 20;

export function batteryLevel(percent: number | undefined): BatteryLevel | undefined {
  if (percent === undefined || !Number.isFinite(percent)) return undefined;
  if (percent >= BATTERY_HIGH_FROM) return 'high';
  if (percent >= BATTERY_LOW_BELOW) return 'medium';
  return 'low';
}

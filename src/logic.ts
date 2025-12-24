export const Units = {
  MPH: "mph",
  KPH: "km/h",
} as const;

export type Unit = (typeof Units)[keyof typeof Units];

const MPS_TO_MPH = 2.2369362920544;
const MPS_TO_KPH = 3.6;

/**
 * Converts a speed in meters per second to the target unit.
 * Clamps the result between 0 and 999.
 * Rounds to the nearest integer.
 * Returns 0 if input is invalid (NaN, Infinity, negative).
 */
export function convertSpeed(metersPerSecond: number, unit: Unit): number {
  if (!Number.isFinite(metersPerSecond)) {
    return 0;
  }

  let value: number;
  if (unit === Units.MPH) {
    value = metersPerSecond * MPS_TO_MPH;
  } else {
    value = metersPerSecond * MPS_TO_KPH;
  }

  // Clamp between 0 and 999
  const clamped = Math.min(Math.max(value, 0), 999);

  // Round to integer
  return Math.round(clamped);
}

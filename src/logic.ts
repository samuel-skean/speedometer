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

export interface FormattedDuration {
  value: number;
  unit: "second" | "minute" | "hour" | "day" | "year";
  maxDigits: number;
}

export function formatDuration(ms: number): FormattedDuration {
  // Handle edge cases
  if (!Number.isFinite(ms) || ms < 0) {
    return { value: 0, unit: "second", maxDigits: 2 };
  }

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return { value: seconds, unit: "second", maxDigits: 2 };
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return { value: minutes, unit: "minute", maxDigits: 2 };
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return { value: hours, unit: "hour", maxDigits: 2 };
  }

  const days = Math.floor(hours / 24);
  if (days < 365) {
    return { value: days, unit: "day", maxDigits: 3 };
  }

  const years = Math.floor(days / 365);
  // Default to 3 digits for years (up to 999 years)
  return { value: years, unit: "year", maxDigits: 3 };
}

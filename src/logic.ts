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

export function formatDuration(ms: number): FormattedDuration[] {
  // Handle edge cases
  if (!Number.isFinite(ms) || ms < 0) {
    return [{ value: 0, unit: "second", maxDigits: 2 }];
  }

  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) {
    return [{ value: totalSeconds, unit: "second", maxDigits: 2 }];
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    const seconds = totalSeconds % 60;
    return [
      { value: totalMinutes, unit: "minute", maxDigits: 2 },
      { value: seconds, unit: "second", maxDigits: 2 },
    ];
  }

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const minutes = totalMinutes % 60;
    return [
      { value: totalHours, unit: "hour", maxDigits: 2 },
      { value: minutes, unit: "minute", maxDigits: 2 },
    ];
  }

  const totalDays = Math.floor(totalHours / 24);
  if (totalDays < 365) {
    const hours = totalHours % 24;
    return [
      { value: totalDays, unit: "day", maxDigits: 3 },
      { value: hours, unit: "hour", maxDigits: 2 },
    ];
  }

  const years = Math.floor(totalDays / 365);
  // Calculate remaining hours excluding full years
  // 1 year = 365 days.
  // Note: This logic assumes 1 year = 365 days exactly (ignoring leap years for simplicity as per common stopwatch logic unless specified)
  const remainingDays = totalDays % 365;
  const remainingHoursFromDays = remainingDays * 24;
  const hoursFromPartialDay = totalHours % 24;
  const totalRemainingHours = remainingHoursFromDays + hoursFromPartialDay;

  // Default to 3 digits for years (up to 999 years)
  // Max digits for hours in a year: 364 * 24 + 23 = 8759 -> 4 digits
  return [
    { value: years, unit: "year", maxDigits: 3 },
    { value: totalRemainingHours, unit: "hour", maxDigits: 4 },
  ];
}

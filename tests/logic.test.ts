import { describe, expect, it } from "vitest";
import { convertSpeed, formatDuration, Units } from "../src/logic";

describe("Logic: Speed Conversion", () => {
  describe("Standard Conversions", () => {
    it("converts 0 m/s to 0 mph", () => {
      expect(convertSpeed(0, Units.MPH)).toBe(0);
    });

    it("converts 0 m/s to 0 km/h", () => {
      expect(convertSpeed(0, Units.KPH)).toBe(0);
    });

    it("converts 10 m/s to mph correctly", () => {
      // 10 * 2.236936... = 22.369... -> 22
      expect(convertSpeed(10, Units.MPH)).toBe(22);
    });

    it("converts 10 m/s to km/h correctly", () => {
      // 10 * 3.6 = 36
      expect(convertSpeed(10, Units.KPH)).toBe(36);
    });

    it("converts 28 m/s (~62mph) to mph", () => {
      // 28 * 2.236936... = 62.63 -> 63
      expect(convertSpeed(28, Units.MPH)).toBe(63);
    });
  });

  describe("Edge Cases & Limits", () => {
    it("clamps negative speed to 0", () => {
      expect(convertSpeed(-5, Units.MPH)).toBe(0);
      expect(convertSpeed(-100, Units.KPH)).toBe(0);
    });

    it("clamps excessive speed to 999", () => {
      // 1000 m/s is way faster than 999 mph
      expect(convertSpeed(1000, Units.MPH)).toBe(999);
      expect(convertSpeed(5000, Units.KPH)).toBe(999);
    });

    it("handles floating point precision reasonably", () => {
      // 0.1 m/s -> 0.22 mph -> 0
      expect(convertSpeed(0.1, Units.MPH)).toBe(0);
      // 0.3 m/s -> 0.67 mph -> 1
      expect(convertSpeed(0.3, Units.MPH)).toBe(1);
    });
  });

  describe("Invalid Inputs", () => {
    it("returns 0 for NaN", () => {
      expect(convertSpeed(NaN, Units.MPH)).toBe(0);
    });

    it("returns 0 for Infinity", () => {
      expect(convertSpeed(Infinity, Units.MPH)).toBe(0);
      expect(convertSpeed(Infinity, Units.KPH)).toBe(0);
    });

    it("returns 0 for -Infinity", () => {
      expect(convertSpeed(-Infinity, Units.MPH)).toBe(0);
    });
  });
});

describe("Logic: Format Duration", () => {
  it("formats seconds correctly", () => {
    expect(formatDuration(0)).toEqual({ value: 0, unit: "second", maxDigits: 2 });
    expect(formatDuration(500)).toEqual({ value: 0, unit: "second", maxDigits: 2 });
    expect(formatDuration(1000)).toEqual({ value: 1, unit: "second", maxDigits: 2 });
    expect(formatDuration(59999)).toEqual({ value: 59, unit: "second", maxDigits: 2 });
  });

  it("formats minutes correctly", () => {
    expect(formatDuration(60000)).toEqual({ value: 1, unit: "minute", maxDigits: 2 });
    expect(formatDuration(61000)).toEqual({ value: 1, unit: "minute", maxDigits: 2 });
    expect(formatDuration(3599999)).toEqual({ value: 59, unit: "minute", maxDigits: 2 });
  });

  it("formats hours correctly", () => {
    expect(formatDuration(3600000)).toEqual({ value: 1, unit: "hour", maxDigits: 2 });
    expect(formatDuration(86399999)).toEqual({ value: 23, unit: "hour", maxDigits: 2 });
  });

  it("formats days correctly", () => {
    expect(formatDuration(86400000)).toEqual({ value: 1, unit: "day", maxDigits: 3 });
    // 364 days
    const days364 = 364 * 24 * 3600 * 1000;
    expect(formatDuration(days364)).toEqual({ value: 364, unit: "day", maxDigits: 3 });
  });

  it("formats years correctly", () => {
    // 365 days
    const year1 = 365 * 24 * 3600 * 1000;
    expect(formatDuration(year1)).toEqual({ value: 1, unit: "year", maxDigits: 3 });
    // 1000 years
    const year1000 = 1000 * 365 * 24 * 3600 * 1000;
    expect(formatDuration(year1000)).toEqual({ value: 1000, unit: "year", maxDigits: 3 });
  });

  it("handles negative values", () => {
    expect(formatDuration(-100)).toEqual({ value: 0, unit: "second", maxDigits: 2 });
  });

  it("handles NaN/Infinity", () => {
    expect(formatDuration(NaN)).toEqual({ value: 0, unit: "second", maxDigits: 2 });
    expect(formatDuration(Infinity)).toEqual({ value: 0, unit: "second", maxDigits: 2 });
  });
});

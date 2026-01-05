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

describe("Logic: Format Duration (New Requirements)", () => {
  it("formats < 1 minute as seconds", () => {
    // 59 seconds
    const result = formatDuration(59000);
    expect(result).toEqual([{ value: 59, unit: "second", maxDigits: 2 }]);
  });

  it("formats > 1 minute as minutes and seconds", () => {
    // 1 min 30 sec = 90000 ms
    const result = formatDuration(90000);
    // Expecting 2 components
    expect(result).toEqual([
      { value: 1, unit: "minute", maxDigits: 2 },
      { value: 30, unit: "second", maxDigits: 2 },
    ]);
  });

  it("formats > 1 hour as hours and minutes", () => {
    // 1 hour 30 min = 3600 + 1800 = 5400 sec = 5400000 ms
    const result = formatDuration(5400000);
    expect(result).toEqual([
      { value: 1, unit: "hour", maxDigits: 2 },
      { value: 30, unit: "minute", maxDigits: 2 },
    ]);
  });

  it("formats > 1 day as days and hours", () => {
    // 1 day 2 hours = 24 + 2 = 26 hours
    const result = formatDuration(26 * 3600 * 1000);
    expect(result).toEqual([
      { value: 1, unit: "day", maxDigits: 3 },
      { value: 2, unit: "hour", maxDigits: 2 },
    ]);
  });

  it("formats > 1 year as years and hours", () => {
    // 1 year (365 days) + 5 hours
    const ms = (365 * 24 + 5) * 3600 * 1000;
    const result = formatDuration(ms);
    expect(result).toEqual([
      { value: 1, unit: "year", maxDigits: 3 },
      { value: 5, unit: "hour", maxDigits: 4 }, // Hours in a year can be up to 8760 (approx), so maybe 4 digits?
    ]);
  });
});

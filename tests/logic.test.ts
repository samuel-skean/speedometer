import { describe, it, expect } from 'vitest';
import { convertSpeed, Units } from '../src/logic';

describe('Logic: Speed Conversion', () => {
  describe('Standard Conversions', () => {
    it('converts 0 m/s to 0 mph', () => {
      expect(convertSpeed(0, Units.MPH)).toBe(0);
    });

    it('converts 0 m/s to 0 km/h', () => {
      expect(convertSpeed(0, Units.KPH)).toBe(0);
    });

    it('converts 10 m/s to mph correctly', () => {
      // 10 * 2.236936... = 22.369... -> 22
      expect(convertSpeed(10, Units.MPH)).toBe(22);
    });

    it('converts 10 m/s to km/h correctly', () => {
      // 10 * 3.6 = 36
      expect(convertSpeed(10, Units.KPH)).toBe(36);
    });

    it('converts 28 m/s (~62mph) to mph', () => {
        // 28 * 2.236936... = 62.63 -> 63
        expect(convertSpeed(28, Units.MPH)).toBe(63);
    });
  });

  describe('Edge Cases & Limits', () => {
    it('clamps negative speed to 0', () => {
      expect(convertSpeed(-5, Units.MPH)).toBe(0);
      expect(convertSpeed(-100, Units.KPH)).toBe(0);
    });

    it('clamps excessive speed to 999', () => {
      // 1000 m/s is way faster than 999 mph
      expect(convertSpeed(1000, Units.MPH)).toBe(999);
      expect(convertSpeed(5000, Units.KPH)).toBe(999);
    });

    it('handles floating point precision reasonably', () => {
      // 0.1 m/s -> 0.22 mph -> 0
      expect(convertSpeed(0.1, Units.MPH)).toBe(0);
      // 0.3 m/s -> 0.67 mph -> 1
      expect(convertSpeed(0.3, Units.MPH)).toBe(1);
    });
  });

  describe('Invalid Inputs', () => {
    it('returns 0 for NaN', () => {
      expect(convertSpeed(NaN, Units.MPH)).toBe(0);
    });

    it('returns 0 for Infinity', () => {
      expect(convertSpeed(Infinity, Units.MPH)).toBe(0);
      expect(convertSpeed(Infinity, Units.KPH)).toBe(0);
    });

    it('returns 0 for -Infinity', () => {
      expect(convertSpeed(-Infinity, Units.MPH)).toBe(0);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent } from '@testing-library/dom';
import { init } from '../src/app';

// Mock types for Geolocation
type MockWatchPosition = (
  success: PositionCallback,
  error?: PositionErrorCallback,
  options?: PositionOptions
) => number;

describe('Speedometer App', () => {
  let speedEl: HTMLElement;
  let statusEl: HTMLElement;
  let unitBtn: HTMLElement;
  let keepScreenOnEl: HTMLInputElement;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div class="container">
          <div id="speed" class="speed">&mdash;&mdash;&mdash;</div>
          <button id="unit" class="unit" aria-label="Toggle speed units">mph</button>
      </div>
      <div class="bottom-bar">
          <div class="bottom-left-controls">
              <label for="keepScreenOn">Stay<br>Awake</label>
              <input type="checkbox" id="keepScreenOn" />
          </div>
          <div id="status" class="status">Waiting for GPS...</div>
      </div>
    `;

    speedEl = document.getElementById('speed')!;
    statusEl = document.getElementById('status')!;
    unitBtn = document.getElementById('unit')!;
    keepScreenOnEl = document.getElementById('keepScreenOn')! as HTMLInputElement;

    // Reset LocalStorage
    localStorage.clear();

    // Mock Geolocation
    const mockGeolocation = {
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });

    // Mock WakeLock
    Object.defineProperty(navigator, 'wakeLock', {
      value: {
        request: vi.fn().mockResolvedValue({
          release: vi.fn(),
          addEventListener: vi.fn(),
        }),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default values', () => {
    init();
    // &mdash; is parsed to the em dash character '—'
    expect(speedEl.innerHTML).toBe('———');
    expect(unitBtn.textContent).toBe('mph');
    expect(statusEl.textContent).toBe('Requesting GPS...');
  });

  it('toggles units when button is clicked', () => {
    init();
    expect(unitBtn.textContent).toBe('mph');

    fireEvent.click(unitBtn);
    expect(unitBtn.textContent).toBe('km/h');
    expect(localStorage.getItem('speed-unit')).toBe('km/h');

    fireEvent.click(unitBtn);
    expect(unitBtn.textContent).toBe('mph');
    expect(localStorage.getItem('speed-unit')).toBe('mph');
  });

  it('updates speed when geolocation provides data', () => {
    let watchSuccessCallback: PositionCallback;

    // Capture the callback passed to watchPosition
    (navigator.geolocation.watchPosition as unknown as any).mockImplementation((success: PositionCallback) => {
      watchSuccessCallback = success;
      return 1;
    });

    init();

    // Simulate position update: 10 m/s
    // 10 m/s * 2.23694 = 22.3694 mph -> rounded to 22
    const mockPosition = {
      coords: {
        speed: 10,
        accuracy: 5,
        latitude: 0,
        longitude: 0,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
      },
      timestamp: Date.now(),
    };

    // Trigger the callback
    // biome-ignore lint/style/noNonNullAssertion: Test setup guarantees this
    watchSuccessCallback!(mockPosition as unknown as GeolocationPosition);

    expect(speedEl.textContent).toBe('22');
    expect(statusEl.textContent).toBe('Accuracy: ±5m');

    // Toggle unit to km/h
    // 10 m/s * 3.6 = 36 km/h
    fireEvent.click(unitBtn);
    expect(speedEl.textContent).toBe('36');
  });

  it('handles invalid speed data', () => {
      let watchSuccessCallback: PositionCallback;
      (navigator.geolocation.watchPosition as unknown as any).mockImplementation((success: PositionCallback) => {
        watchSuccessCallback = success;
        return 1;
      });

      init();

      // Speed is null (e.g. not moving/calculable by GPS yet)
      const mockPosition = {
        coords: {
          speed: null,
          accuracy: 10,
        },
        timestamp: Date.now(),
      };

      // biome-ignore lint/style/noNonNullAssertion: Test setup guarantees this
      watchSuccessCallback!(mockPosition as unknown as GeolocationPosition);

      // Should remain dashes if speed is null (no update logic triggered for null speed in app.ts)
      // Actually app.ts says: if (typeof speed === "number" ...). If null, it skips renderSpeed.
      expect(speedEl.textContent).toMatch(/—+/);
    });

  it('displays error status when geolocation fails', () => {
    let watchErrorCallback: PositionErrorCallback;

    (navigator.geolocation.watchPosition as unknown as any).mockImplementation((_: any, error: PositionErrorCallback) => {
      watchErrorCallback = error;
      return 1;
    });

    init();

    // The app code accesses constants on the error instance (e.g. err.PERMISSION_DENIED)
    const mockError = {
      code: 1,
      message: 'User denied',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    // biome-ignore lint/style/noNonNullAssertion: Test setup
    watchErrorCallback!(mockError as unknown as GeolocationPositionError);

    expect(statusEl.textContent).toContain('permission denied');
  });

  it('requests wake lock when checkbox is checked', async () => {
    init();

    // Simulate click
    fireEvent.click(keepScreenOnEl); // changes checked state to true and fires change event
    // Wait for async handler
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
  });
});

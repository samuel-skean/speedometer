import { fireEvent } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { init, PLACEHOLDER, resetState } from "../src/app";

describe("Speedometer App", () => {
  let speedEl: HTMLElement;
  let statusEl: HTMLElement;
  let unitBtn: HTMLElement;
  let keepScreenOnEl: HTMLInputElement;
  let warningEl: HTMLElement;
  let mobileOverride: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset DOM
    document.body.innerHTML = `
      <div id="warning" class="warning" hidden>Speed data is old</div>
      <div class="container">
          <div
            id="speed"
            class="speed"
            data-placeholder="${PLACEHOLDER}"
            data-placeholder-visible="true"
          >${PLACEHOLDER}</div>
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

    const speedElNullable = document.getElementById("speed");
    if (!speedElNullable) {
      throw new Error("Speed element not found");
    }
    speedEl = speedElNullable;

    const statusElNullable = document.getElementById("status");
    if (!statusElNullable) {
      throw new Error("Status element not found");
    }
    statusEl = statusElNullable;

    const unitBtnNullable = document.getElementById("unit");
    if (!unitBtnNullable) {
      throw new Error("Unit button not found");
    }
    unitBtn = unitBtnNullable;

    const keepScreenOnElNullable = document.getElementById("keepScreenOn");
    if (!keepScreenOnElNullable) {
      throw new Error("Keep screen on element not found");
    }
    keepScreenOnEl = keepScreenOnElNullable as HTMLInputElement;

    const warningElNullable = document.getElementById("warning");
    if (!warningElNullable) {
      throw new Error("Warning element not found");
    }
    warningEl = warningElNullable;

    // Provide a speed getter to simulate platforms that expose native speed
    function MockGeolocationCoordinates(this: unknown): void {}
    Object.defineProperty(MockGeolocationCoordinates.prototype, "speed", {
      get() {
        return 0;
      },
      configurable: true,
    });
    Object.defineProperty(globalThis, "GeolocationCoordinates", {
      value: MockGeolocationCoordinates,
      writable: true,
    });

    // Reset LocalStorage
    localStorage.clear();

    // Mock Geolocation
    const mockGeolocation = {
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };
    Object.defineProperty(navigator, "geolocation", {
      value: mockGeolocation,
      writable: true,
    });

    // Mock WakeLock
    Object.defineProperty(navigator, "wakeLock", {
      value: {
        request: vi.fn().mockResolvedValue({
          release: vi.fn(),
          addEventListener: vi.fn(),
        }),
      },
      writable: true,
    });

    mobileOverride = Object.getOwnPropertyDescriptor(
      navigator,
      "userAgentData",
    );
    Object.defineProperty(navigator, "userAgentData", {
      value: { mobile: true },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    resetState();

    if (mobileOverride) {
      Object.defineProperty(navigator, "userAgentData", mobileOverride);
    } else {
      delete (navigator as { userAgentData?: unknown }).userAgentData;
    }
  });

  it("initializes with default values", () => {
    init();
    expect(speedEl.textContent).toBe(PLACEHOLDER);
    expect(unitBtn.textContent).toBe("mph");
    expect(statusEl.textContent).toBe("Requesting GPS...");
    expect(warningEl.hidden).toBe(true);
  });

  it("toggles units when button is clicked", () => {
    init();
    expect(unitBtn.textContent).toBe("mph");

    fireEvent.click(unitBtn);
    expect(unitBtn.textContent).toBe("km/h");
    expect(localStorage.getItem("speed-unit")).toBe("km/h");

    fireEvent.click(unitBtn);
    expect(unitBtn.textContent).toBe("mph");
    expect(localStorage.getItem("speed-unit")).toBe("mph");
  });

  it("updates speed when geolocation provides data", () => {
    let watchSuccessCallback: PositionCallback | undefined;

    // Capture the callback passed to watchPosition
    const watchPositionSpy = vi
      .spyOn(navigator.geolocation, "watchPosition")
      .mockImplementation((success) => {
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
    if (watchSuccessCallback) {
      // First update starts the timer
      watchSuccessCallback(mockPosition as unknown as GeolocationPosition);

      // Advance time by 1s (GPS_WARMUP_MS)
      vi.advanceTimersByTime(1000);

      // Send it again to trigger the update
      watchSuccessCallback(mockPosition as unknown as GeolocationPosition);
    } else {
      throw new Error("watchSuccessCallback was not set");
    }

    expect(speedEl.textContent).toBe("22");
    expect(speedEl.dataset.placeholderVisible).toBe("false");
    expect(statusEl.textContent).toBe("Accuracy: ±5m");
    expect(warningEl.hidden).toBe(true);

    // Toggle unit to km/h
    // 10 m/s * 3.6 = 36 km/h
    fireEvent.click(unitBtn);
    expect(speedEl.textContent).toBe("36");

    watchPositionSpy.mockRestore();
  });

  it("shows a dual-unit stale warning with fixed-width numbers", () => {
    let watchSuccessCallback: PositionCallback | undefined;

    const watchPositionSpy = vi
      .spyOn(navigator.geolocation, "watchPosition")
      .mockImplementation((success) => {
        watchSuccessCallback = success;
        return 1;
      });

    init();

    const mockPosition = {
      coords: {
        speed: 10,
        accuracy: 9,
      },
      timestamp: Date.now(),
    };

    if (watchSuccessCallback) {
      watchSuccessCallback(mockPosition as unknown as GeolocationPosition);

      vi.advanceTimersByTime(1000);

      watchSuccessCallback(mockPosition as unknown as GeolocationPosition);
    }

    vi.advanceTimersByTime(6500);

    expect(warningEl.hidden).toBe(false);

    const numbers = Array.from(
      warningEl.querySelectorAll(".warning-number"),
      (el) => el.textContent,
    );
    expect(numbers).toEqual(["00", "06"]);

    const labels = Array.from(
      warningEl.querySelectorAll(".warning-label"),
      (el) => el.textContent,
    );
    expect(labels).toEqual(["minutes", "seconds"]);

    watchPositionSpy.mockRestore();
  });

  it("ignores readings during warmup period", () => {
    let watchSuccessCallback: PositionCallback | undefined;

    const watchPositionSpy = vi
      .spyOn(navigator.geolocation, "watchPosition")
      .mockImplementation((success) => {
        watchSuccessCallback = success;
        return 1;
      });

    init();

    const mockPosition = {
      coords: {
        speed: 10,
        accuracy: 5,
      },
      timestamp: Date.now(),
    };

    if (watchSuccessCallback) {
      // Reading 1 (T=0) -> Ignored
      watchSuccessCallback(mockPosition as unknown as GeolocationPosition);
      expect(speedEl.textContent).toBe(PLACEHOLDER);

      // Reading 2 (T=0.5s) -> Ignored
      vi.advanceTimersByTime(500);
      watchSuccessCallback(mockPosition as unknown as GeolocationPosition);
      expect(speedEl.textContent).toBe(PLACEHOLDER);

      // Reading 3 (T=1.0s) -> Accepted (>= GPS_WARMUP_MS)
      vi.advanceTimersByTime(500);
      watchSuccessCallback(mockPosition as unknown as GeolocationPosition);
      // 10 m/s * 2.23694 = 22.3694 -> 22
      expect(speedEl.textContent).toBe("22");
    } else {
      throw new Error("watchSuccessCallback was not set");
    }

    watchPositionSpy.mockRestore();
  });

  it("handles invalid speed data", () => {
    let watchSuccessCallback: PositionCallback | undefined;
    const watchPositionSpy = vi
      .spyOn(navigator.geolocation, "watchPosition")
      .mockImplementation((success) => {
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

    if (watchSuccessCallback) {
      watchSuccessCallback(mockPosition as unknown as GeolocationPosition);
    } else {
      throw new Error("watchSuccessCallback was not set");
    }

    // Should remain placeholder if speed is null (no update logic triggered for null speed in app.ts)
    // Actually app.ts says: if (typeof speed === "number" ...). If null, it skips renderSpeed.
    expect(speedEl.textContent).toBe(PLACEHOLDER);
    expect(speedEl.dataset.placeholderVisible).toBe("true");

    watchPositionSpy.mockRestore();
  });

  it("displays error status when geolocation fails", () => {
    let watchErrorCallback: PositionErrorCallback | undefined;

    const watchPositionSpy = vi
      .spyOn(navigator.geolocation, "watchPosition")
      .mockImplementation((_, error) => {
        if (error === null) {
          throw new Error(`error was null`);
        }
        watchErrorCallback = error;
        return 1;
      });

    init();

    // The app code accesses constants on the error instance (e.g. err.PERMISSION_DENIED)
    const mockError = {
      code: 1,
      message: "User denied",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    };

    if (watchErrorCallback) {
      watchErrorCallback(mockError as unknown as GeolocationPositionError);
    } else {
      throw new Error("watchErrorCallback was not set");
    }

    expect(statusEl.textContent).toContain("permission denied");

    watchPositionSpy.mockRestore();
  });

  it("requests wake lock when checkbox is checked", async () => {
    init();

    // Simulate click
    fireEvent.click(keepScreenOnEl); // changes checked state to true and fires change event

    expect(navigator.wakeLock.request).toHaveBeenCalledWith("screen");
  });

  it("handles garbage geolocation data gracefully", () => {
    let watchSuccessCallback: PositionCallback | undefined;
    const watchPositionSpy = vi
      .spyOn(navigator.geolocation, "watchPosition")
      .mockImplementation((success) => {
        watchSuccessCallback = success;
        return 1;
      });

    init();

    const garbageInputs = [
      { speed: -50, label: "negative speed" },
      { speed: Infinity, label: "infinity" },
      { speed: NaN, label: "NaN" },
    ];

    garbageInputs.forEach((input) => {
      const mockPosition = {
        coords: {
          speed: input.speed,
          accuracy: 5,
        },
        timestamp: Date.now(),
      };

      if (watchSuccessCallback) {
        watchSuccessCallback(mockPosition as unknown as GeolocationPosition);
      } else {
        throw new Error("watchSuccessCallback was not set");
      }

      // The UI should verify it's valid before rendering, so it shouldn't update to "0" or "Infinity" if filtered out by handlePosition.
      // BUT wait, app.ts handlePosition checks: if (typeof speed === "number" && Number.isFinite(speed) && speed >= 0)
      // So for these invalid inputs, renderSpeed is NOT called.
      // Thus the display should remain at the default (or previous value).

      // Let's verify it remains the placeholder (since we haven't sent a valid speed yet).
      expect(speedEl.textContent).toBe(PLACEHOLDER);
    });

    // Now send a valid speed to prove it still works
    const validPosition = {
      coords: { speed: 10, accuracy: 5 },
      timestamp: Date.now(),
    };
    if (watchSuccessCallback) {
      // First one ignored
      watchSuccessCallback(validPosition as unknown as GeolocationPosition);

      // Advance past warmup
      vi.advanceTimersByTime(1000);

      // Second one accepted
      watchSuccessCallback(validPosition as unknown as GeolocationPosition);
    } else {
      throw new Error("watchSuccessCallback was not set");
    }
    expect(speedEl.textContent).toBe("22");

    watchPositionSpy.mockRestore();
  });

  it("replaces the UI when the platform can't provide speed", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      (globalThis as { GeolocationCoordinates: typeof GeolocationCoordinates })
        .GeolocationCoordinates.prototype,
      "speed",
    );

    delete (
      globalThis as { GeolocationCoordinates: typeof GeolocationCoordinates }
    ).GeolocationCoordinates.prototype.speed;

    init();

    const bodyText = document.body.textContent ?? "";
    expect(bodyText).toContain("Unsupported device");
    expect(bodyText).toContain("can't report GPS speed");

    // Restore the descriptor for other tests
    if (originalDescriptor) {
      Object.defineProperty(
        (
          globalThis as {
            GeolocationCoordinates: typeof GeolocationCoordinates;
          }
        ).GeolocationCoordinates.prototype,
        "speed",
        originalDescriptor,
      );
    }
  });

  it("replaces the UI on devices that report no GPS hardware", () => {
    Object.defineProperty(navigator, "userAgentData", {
      value: { mobile: false },
      configurable: true,
    });

    init();

    const bodyText = document.body.textContent ?? "";
    expect(bodyText).toContain("Unsupported device");
    expect(bodyText).toContain("doesn't have built-in GPS hardware");
  });
});

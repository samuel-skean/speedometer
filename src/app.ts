/**
 * Basic speedometer using the Geolocation API, simplified.
 * - Uses ONLY native position.coords.speed (m/s).
 * - No distance/time fallback when speed is unavailable.
 * - Displays speed centered on screen; unit toggle between mph and km/h.
 */

const speedEl = document.getElementById("speed") as HTMLDivElement | null;
const statusEl = document.getElementById("status") as HTMLDivElement | null;
const unitBtn = document.getElementById("unit") as HTMLButtonElement | null;
const keepScreenOnEl = document.getElementById(
  "keepScreenOn",
) as HTMLInputElement | null;

const Units = {
  MPH: "mph",
  KPH: "km/h",
} as const;
type Unit = (typeof Units)[keyof typeof Units];

const MPS_TO_MPH = 2.2369362920544;
const MPS_TO_KPH = 3.6;

let currentUnit: Unit =
  (localStorage.getItem("speed-unit") as Unit) || Units.MPH;
let lastSpeedMs: number | null = null; // last known native speed (m/s), if any
let wakeLock: WakeLockSentinel | null = null;

function updateUnitUI(): void {
  if (unitBtn) unitBtn.textContent = currentUnit;
}

// Render the speed (expects m/s)
function renderSpeed(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) {
    setStatus("FIXME: Error");
    return;
  }
  const value = currentUnit === Units.MPH ? ms * MPS_TO_MPH : ms * MPS_TO_KPH;
  const clamped = Math.min(Math.max(value, 0), 999);
  const rounded = Math.round(clamped);
  if (speedEl) speedEl.textContent = String(rounded);
}

function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}

async function handleWakeLock(): Promise<void> {
  if (!("wakeLock" in navigator)) {
    if (keepScreenOnEl) keepScreenOnEl.disabled = true;
    return;
  }

  try {
    if (keepScreenOnEl?.checked) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        // tristate checkbox: indeterminate when released by system
        if (keepScreenOnEl) keepScreenOnEl.indeterminate = true;
      });
    } else {
      wakeLock?.release();
      wakeLock = null;
    }
    if (keepScreenOnEl) {
      localStorage.setItem("keepScreenOn", String(keepScreenOnEl.checked));
    }
  } catch (err) {
    console.error("Wake Lock error:", err);
    if (keepScreenOnEl) keepScreenOnEl.checked = false;
  }
}

function handlePosition(pos: GeolocationPosition): void {
  const { speed, accuracy } = pos.coords;

  // Update speed only when native speed is provided and valid
  if (typeof speed === "number" && Number.isFinite(speed) && speed >= 0) {
    lastSpeedMs = speed;
    renderSpeed(speed);
  }

  // Status/accuracy
  if (typeof accuracy === "number" && Number.isFinite(accuracy)) {
    setStatus(`Accuracy: ±${Math.round(accuracy)}m`);
  } else {
    setStatus("GPS fix acquired");
  }
}

function handleError(err: GeolocationPositionError): void {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      setStatus("Location permission denied. Enable it to see speed.");
      break;
    case err.POSITION_UNAVAILABLE:
      setStatus("Location unavailable. Move to open sky for GPS.");
      break;
    case err.TIMEOUT:
      setStatus("Location timeout. Trying again...");
      break;
    default:
      setStatus(`Error: ${err.message}`);
  }
}

function init(): void {
  updateUnitUI();

  // Unit toggle
  unitBtn?.addEventListener("click", () => {
    currentUnit = currentUnit === Units.MPH ? Units.KPH : Units.MPH;
    localStorage.setItem("speed-unit", currentUnit);
    updateUnitUI();
    // Re-render current speed in new units (fallback to 0 if we haven't seen a value)
    if (lastSpeedMs !== null) {
      renderSpeed(lastSpeedMs);
    }
  });

  // Screen wake lock
  if (keepScreenOnEl) {
    keepScreenOnEl.addEventListener("change", handleWakeLock);
    // Restore state from localStorage
    const savedState = localStorage.getItem("keepScreenOn");
    if (savedState) {
      keepScreenOnEl.checked = savedState === "true";
    }
    handleWakeLock();
  }
  // Re-acquire wake lock on visibility change
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      handleWakeLock();
    }
  });

  // Request high-accuracy GPS and frequent updates
  const watchOptions: PositionOptions = {
    enableHighAccuracy: true,
    maximumAge: 1000, // accept 1s old cached positions
    timeout: 10000, // 10s per fix
  };

  if ("geolocation" in navigator) {
    setStatus("Requesting GPS...");
    navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      watchOptions,
    );
  } else {
    setStatus("Geolocation not supported on this device.");
  }
}

// Run immediately in module scope once DOM is ready enough for our elements
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

// Register service worker from the app bundle so it’s included in production builds
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((e) => console.error("SW registration failed:", e));
  });
}

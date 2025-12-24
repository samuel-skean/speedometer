/**
 * Basic speedometer using the Geolocation API, simplified.
 * - Uses ONLY native position.coords.speed (m/s).
 * - No distance/time fallback when speed is unavailable.
 * - Displays speed centered on screen; unit toggle between mph and km/h.
 */
import { convertSpeed, formatDuration, type Unit, Units } from "./logic";

// Define DOM elements
let speedEl: HTMLDivElement;
let statusEl: HTMLDivElement;
let unitBtn: HTMLButtonElement;
let keepScreenOnEl: HTMLInputElement;
let warningEl: HTMLDivElement;

// Mutable state
let currentUnit: Unit;
let lastSpeedMs: number | null = null; // last known native speed (m/s), if any
let lastUpdateTimestamp = 0;
let wakeLock: WakeLockSentinel | null = null;

function updateUnitUI(): void {
  if (unitBtn) unitBtn.textContent = currentUnit;
}

// Render the speed (expects m/s)
function renderSpeed(metersPerSecond: number): void {
  // Check validity
  if (!Number.isFinite(metersPerSecond) || metersPerSecond < 0) {
    setStatus("FIXME: Error");
    if (speedEl) speedEl.innerHTML = "&mdash;&mdash;&mdash;";
    return;
  }

  // Use shared logic for conversion
  const rounded = convertSpeed(metersPerSecond, currentUnit);
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
      keepScreenOnEl.indeterminate = false;
      wakeLock.addEventListener("release", () => {
        // tristate checkbox: indeterminate when released by system
        if (keepScreenOnEl) keepScreenOnEl.indeterminate = true;
      });
    } else {
      wakeLock?.release();
      wakeLock = null;
      if (keepScreenOnEl) keepScreenOnEl.indeterminate = false;
    }
  } catch (_err) {
    if (keepScreenOnEl) keepScreenOnEl.checked = false;
  }
}

function handlePosition(pos: GeolocationPosition): void {
  const { speed, accuracy } = pos.coords;

  // Update speed only when native speed is provided and valid
  if (typeof speed === "number" && Number.isFinite(speed) && speed >= 0) {
    lastSpeedMs = speed;
    renderSpeed(speed);
    // Disable updating timestamp to let the stale warning timer grow indefinitely
    // lastUpdateTimestamp = Date.now();

    // Do not hide warningEl to ensure it is always visible
    // if (warningEl) warningEl.hidden = true;
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

export function resetState(): void {
  lastSpeedMs = null;
  lastUpdateTimestamp = 0;
  wakeLock = null;
}

export function init(): void {
  const speedElNullable = document.getElementById("speed");
  if (!speedElNullable) throw new Error("Speed element not found");
  speedEl = speedElNullable as HTMLDivElement;

  const statusElNullable = document.getElementById("status");
  if (!statusElNullable) throw new Error("Status element not found");
  statusEl = statusElNullable as HTMLDivElement;

  const unitBtnNullable = document.getElementById("unit");
  if (!unitBtnNullable) throw new Error("Unit button not found");
  unitBtn = unitBtnNullable as HTMLButtonElement;

  const keepScreenOnElNullable = document.getElementById("keepScreenOn");
  if (!keepScreenOnElNullable)
    throw new Error("Keep screen on element not found");
  keepScreenOnEl = keepScreenOnElNullable as HTMLInputElement;

  const warningElNullable = document.getElementById("warning");
  if (!warningElNullable) throw new Error("Warning element not found");
  warningEl = warningElNullable as HTMLDivElement;

  // Make warning visible immediately
  warningEl.hidden = false;

  // Initialize state from local storage or default
  currentUnit = (localStorage.getItem("speed-unit") as Unit) || Units.MPH;

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
  keepScreenOnEl.addEventListener("change", handleWakeLock);
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

  // Initialize timestamp to now so the counter starts from 0 instead of waiting for first fix
  lastUpdateTimestamp = Date.now();

  // Simulated duration accumulator
  let simulatedDuration = 0;

  if ("geolocation" in navigator) {
    setStatus("Requesting GPS...");
    navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      watchOptions,
    );

    // Update timer every second
    setInterval(() => {
      // Simulate rapid time passing: add 1 hour (3600000ms) per second
      simulatedDuration += 3600000;

      if (warningEl) {
        // Always ensure it's visible
        warningEl.hidden = false;

        const { value, unit, maxDigits } = formatDuration(simulatedDuration);

        // Singular/Plural
        const unitLabel = value === 1 ? unit : `${unit}s`;

        // Construct HTML with reserved width for digits
        warningEl.innerHTML = `Speed data is <span class="warning-digits" style="min-width: ${maxDigits}ch">${value}</span> ${unitLabel} old`;
      }
    }, 1000);
  } else {
    setStatus("Geolocation not supported on this device.");
  }

  // Service Worker Registration
  if ("serviceWorker" in navigator && !import.meta.env.DEV) {
    // Avoid SW in dev/test if desired, or keep as is
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js")
        .catch((e) => console.error("SW registration failed:", e));
    });
  }
}

// Check if running in a test environment
const isTest = import.meta.env.TEST;

if (!isTest) {
  // Run immediately in module scope once DOM is ready enough for our elements
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}

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
let firstSpeedTimestamp: number | null = null;

const GPS_WARMUP_MS = 1000;

export const PLACEHOLDER = "———";

function showPlaceholder(): void {
  if (speedEl) {
    speedEl.dataset.placeholderVisible = "true";
    speedEl.textContent = PLACEHOLDER;
  }
}

function updateUnitUI(): void {
  if (unitBtn) {
    unitBtn.textContent = currentUnit;
  }
}

// Render the speed (expects m/s)
function renderSpeed(metersPerSecond: number): void {
  // Check validity
  if (!Number.isFinite(metersPerSecond) || metersPerSecond < 0) {
    setStatus("FIXME: Error");
    showPlaceholder();
    return;
  }

  // Use shared logic for conversion
  const rounded = convertSpeed(metersPerSecond, currentUnit);
  if (speedEl) {
    speedEl.dataset.placeholderVisible = "false";
    speedEl.textContent = String(rounded);
  }
}

function setStatus(text: string): void {
  if (statusEl) {
    statusEl.textContent = text;
  }
}

function renderUnsupported(): void {
  document.body.innerHTML = `
    <main class="unsupported" role="alert">
      <div class="unsupported__content">
        <p class="unsupported__eyebrow">Unsupported device</p>
        <h1>This device can't report GPS speed.</h1>
        <p>
          Your browser's location API is missing the native <code>speed</code> field this
          app relies on, or this device doesn't have built-in GPS hardware, so we can't show
          your speed here.
        </p>
      </div>
    </main>
  `;
}

function hasNativeSpeedField(): boolean {
  // Basic geolocation support check
  if (!("geolocation" in navigator)) {
    return false;
  }

  const coordsCtor = (globalThis as { GeolocationCoordinates?: unknown })
    .GeolocationCoordinates;

  if (typeof coordsCtor !== "function") {
    return false;
  }

  const descriptor = Object.getOwnPropertyDescriptor(
    coordsCtor.prototype,
    "speed",
  );

  if (!descriptor) {
    return false;
  }

  if (typeof descriptor.get === "function") {
    try {
      const value = descriptor.get.call(Object.create(coordsCtor.prototype));
      if (typeof value === "number" || value === null) {
        return true;
      }
    } catch (_err) {
      // Ignore getter errors and continue to fallback checks below
    }
  }

  return "value" in descriptor || typeof descriptor.get === "function";
}

function isLikelyGpsDevice(): boolean {
  const uaData = (
    navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  ).userAgentData;

  if (typeof uaData?.mobile === "boolean") {
    return uaData.mobile;
  }

  const ua = navigator.userAgent || "";

  return /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
}

function isStandalone(): boolean {
  // Check standard display-mode
  const isStandaloneMode = window.matchMedia(
    "(display-mode: standalone)",
  ).matches;

  // Check iOS legacy
  // @ts-expect-error - navigator.standalone is non-standard but exists on iOS
  const isIOSStandalone = navigator.standalone === true;

  return isStandaloneMode || isIOSStandalone;
}

async function handleWakeLock(): Promise<void> {
  if (!("wakeLock" in navigator)) {
    if (keepScreenOnEl) {
      keepScreenOnEl.disabled = true;
    }
    return;
  }

  try {
    if (keepScreenOnEl?.checked) {
      wakeLock = await navigator.wakeLock.request("screen");
      keepScreenOnEl.indeterminate = false;
      wakeLock.addEventListener("release", () => {
        // tristate checkbox: indeterminate when released by system
        if (keepScreenOnEl) {
          keepScreenOnEl.indeterminate = true;
        }
      });
    } else {
      wakeLock?.release();
      wakeLock = null;
      if (keepScreenOnEl) {
        keepScreenOnEl.indeterminate = false;
      }
    }
  } catch (_err) {
    if (keepScreenOnEl) {
      keepScreenOnEl.checked = false;
    }
  }
}

function handlePosition(pos: GeolocationPosition): void {
  const { speed, accuracy } = pos.coords;

  // Update speed only when native speed is provided and valid
  if (typeof speed === "number" && Number.isFinite(speed) && speed >= 0) {
    const now = Date.now();
    if (firstSpeedTimestamp === null) {
      firstSpeedTimestamp = now;
    }

    if (now - firstSpeedTimestamp >= GPS_WARMUP_MS) {
      lastSpeedMs = speed;
      renderSpeed(speed);
      lastUpdateTimestamp = now;
      if (warningEl) {
        warningEl.hidden = true;
      }
    }
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
  firstSpeedTimestamp = null;
}

export function init(): void {
  if (!hasNativeSpeedField() || !isLikelyGpsDevice()) {
    renderUnsupported();
    return;
  }

  const speedElNullable = document.getElementById("speed");
  if (!speedElNullable) {
    throw new Error("Speed element not found");
  }
  speedEl = speedElNullable as HTMLDivElement;
  speedEl.dataset.placeholder = PLACEHOLDER;
  showPlaceholder();

  const statusElNullable = document.getElementById("status");
  if (!statusElNullable) {
    throw new Error("Status element not found");
  }
  statusEl = statusElNullable as HTMLDivElement;

  const unitBtnNullable = document.getElementById("unit");
  if (!unitBtnNullable) {
    throw new Error("Unit button not found");
  }
  unitBtn = unitBtnNullable as HTMLButtonElement;

  const keepScreenOnElNullable = document.getElementById("keepScreenOn");
  if (!keepScreenOnElNullable) {
    throw new Error("Keep screen on element not found");
  }
  keepScreenOnEl = keepScreenOnElNullable as HTMLInputElement;

  const warningElNullable = document.getElementById("warning");
  if (!warningElNullable) {
    throw new Error("Warning element not found");
  }
  warningEl = warningElNullable as HTMLDivElement;

  // Initialize state from local storage or default
  currentUnit = (localStorage.getItem("speed-unit") as Unit) || Units.MPH;

  updateUnitUI();

  // Vibe warning popover logic
  const vibeWarningEl = document.getElementById("vibe-warning");
  const infoBtnEl = document.querySelector(".info-btn");

  if (vibeWarningEl && "showPopover" in vibeWarningEl) {
    const updateExitTarget = () => {
      if (!infoBtnEl) {
        return;
      }
      // Target the SVG for precision, or fallback to button
      const targetEl = infoBtnEl.querySelector("svg") || infoBtnEl;
      const iconRect = targetEl.getBoundingClientRect();
      const iconCenterX = iconRect.left + iconRect.width / 2;
      const iconCenterY = iconRect.top + iconRect.height / 2;

      // Popover is fixed centered (50vw, 50vh) via CSS.
      // We use viewport dimensions because getBoundingClientRect() on the popover
      // returns the transformed position during animation, causing a feedback loop.
      const popoverCenterX = window.innerWidth / 2;
      const popoverCenterY = window.innerHeight / 2;

      const deltaX = iconCenterX - popoverCenterX;
      const deltaY = iconCenterY - popoverCenterY;

      vibeWarningEl.style.setProperty("--exit-x", `${deltaX}px`);
      vibeWarningEl.style.setProperty("--exit-y", `${deltaY}px`);
    };

    // Update on resize
    window.addEventListener("resize", updateExitTarget);

    const hasShownWarning = localStorage.getItem("vibe-warning-shown");
    // Only show automatically if not previously shown AND not installed as PWA
    if (!hasShownWarning && !isStandalone()) {
      (vibeWarningEl as any).showPopover();
      // Calculate immediately
      updateExitTarget();
    }

    vibeWarningEl.addEventListener("toggle", (event: any) => {
      if (event.newState === "open") {
        updateExitTarget();
      } else if (event.newState === "closed") {
        localStorage.setItem("vibe-warning-shown", "true");
      }
    });
  }

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
    maximumAge: 250, // accept 250ms old cached positions (4Hz)
    timeout: 60000, // 60s per fix (increased from 10s to avoid reset loops)
  };

  if ("geolocation" in navigator) {
    setStatus("Requesting GPS...");
    navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      watchOptions,
    );

    // Check for stale data every second
    setInterval(() => {
      const diff = Date.now() - lastUpdateTimestamp;
      if (lastUpdateTimestamp > 0 && diff > 5000) {
        if (warningEl) {
          warningEl.hidden = false;

          const { value, unit, maxDigits } = formatDuration(diff);

          // Singular/Plural
          const unitLabel = value === 1 ? unit : `${unit}s`;

          // Construct HTML with reserved width for digits
          warningEl.innerHTML = `Speed data is <span class="warning-digits" style="min-width: ${maxDigits}ch">${value}</span> ${unitLabel} old`;
        }
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

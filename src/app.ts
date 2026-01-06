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
let unitBtns: NodeListOf<HTMLButtonElement>;
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

// Augment HTMLElement to include the Popover API
interface PopoverElement extends HTMLElement {
  showPopover(): void;
  hidePopover(): void;
  togglePopover(force?: boolean): boolean;
}

// Define the ToggleEvent interface for the popover API
interface ToggleEvent extends Event {
  newState: "open" | "closed";
  oldState: "open" | "closed";
}

function showPlaceholder(): void {
  if (speedEl) {
    speedEl.dataset.placeholderVisible = "true";
    speedEl.textContent = PLACEHOLDER;
  }
}

function updateUnitUI(): void {
  if (unitBtns) {
    for (const btn of unitBtns) {
      btn.textContent = currentUnit;
    }
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

function getMobileOS(): "ios" | "android" | "other" {
  const ua = navigator.userAgent || "";
  // Check iOS
  if (/iPad|iPhone|iPod/.test(ua)) {
    return "ios";
  }
  // Check Android
  if (/Android/.test(ua)) {
    return "android";
  }
  return "other";
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
    if (statusEl) {
      statusEl.classList.remove("status-warning", "status-danger");
      if (accuracy > 100) {
        statusEl.classList.add("status-danger");
      } else if (accuracy > 20) {
        statusEl.classList.add("status-warning");
      }
    }
  } else {
    setStatus("GPS fix acquired");
    if (statusEl) {
      statusEl.classList.remove("status-warning", "status-danger");
    }
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

function startGeolocation(): void {
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

          const parts = formatDuration(diff);

          // Construct HTML parts
          const htmlParts = parts.map((part) => {
            // Add padding for fixed width if needed, but min-width usually handles it if monospaced or tnum
            // For >1 component, we generally want leading zeros if it's the second component?
            // "5m 30s" -> "10m 05s" to keep alignment fixed?
            // The prompt says "Make sure the alignment of all the text remains completely fixed as it ticks up"
            // If we have "5m 30s", and next is "5m 31s", width is same.
            // "9m 59s" -> "10m 00s"
            // We need to ensure each number field reserves enough space.
            // Using `min-width: ${part.maxDigits}ch` helps.
            // Also, for second component, usually we pad with '0' for alignment in digital clocks,
            // e.g. 1m 05s.
            // `formatDuration` logic logic returns value as number.
            // Let's modify display logic to pad with 0 if it is not the first component?
            // User requirement: "starting with the minutes in the same widget that already exists".
            // "Show the stale data stopwatch in two components starting with the minutes"
            // "It should show how many minutes and seconds have passed..."
            // I'll stick to min-width for now. If visual alignment needs leading zero for second component, I'll add it.
            // The user emphasized "completely fixed as it ticks up".
            // If I go from 59s -> 1m 00s.
            // 59s is "59 seconds". 1m 00s is "1 minute 0 seconds" or "1m 0s"?
            // Existing logic used full words "seconds", "minute".
            // Requested logic: "how many minutes and seconds have passed".
            // Maybe it implies "5m 30s" or "5 minutes 30 seconds"?
            // "starting with the minutes... It should show how many minutes and seconds have passed"
            // Given the existing UI uses full words "seconds" etc., and request says "starting with the minutes in the same widget that already exists",
            // I should probably keep the style somewhat consistent but maybe shorter if it gets too long?
            // But "5m 30s" is usually abbreviated.
            // Let's look at the implementation plan again. "Minutes and seconds (e.g., '5m 30s')".
            // I will use abbreviated units for multi-component display to fit better?
            // Or full words? "5 minutes 30 seconds" is very long.
            // The example in my thought process was "5m 30s".
            // Let's assume full words first as per current widget style, unless it breaks layout.
            // Current widget: "Speed data is <span ...>5</span> seconds old"
            // New widget: "Speed data is <span ...>5</span> minutes <span ...>30</span> seconds old"
            // This is getting long.
            // Maybe I should abbreviate if > 1 minute?
            // "Speed data is 5m 30s old"
            // Let's try abbreviated units for the multi-part ones, and keep full word for < 1 minute if desired,
            // or just switch to abbreviated for everything for consistency?
            // The prompt asks for "how many minutes and seconds have passed", not explicitly "m" and "s".
            // However, "starting with the minutes" -> "5m 30s" is a very common stopwatch format.
            // Also "Make sure the alignment... remains completely fixed".
            // Shorter units help with fixed alignment on small screens.
            // I'll use abbreviations for multi-component.
            // For single component (seconds), I'll stick to full word or abbreviation?
            // "Speed data is 5s old" vs "Speed data is 5 seconds old".
            // I will stick to full words for single component to minimize change for < 1 min,
            // and use abbreviations for multi-component to save space.

            const isMultiPart = parts.length > 1;
            const label = isMultiPart
              ? part.unit[0]
              : part.value === 1
                ? part.unit
                : `${part.unit}s`;

            // For multi-part, usually we want "1m 05s" instead of "1m 5s" for alignment?
            // Or just rely on tabular nums?
            // If I have 1m 9s -> 1m 10s. Width changes if I don't pad or reserve space.
            // 1ch vs 2ch.
            // logic `maxDigits` is 2 for seconds/minutes.
            // So I should force `min-width` of 2ch.
            // And maybe pad with zero visually?
            // "05" vs " 5".
            // I'll use `padStart(2, '0')` for the second component values (seconds, minutes in hours, etc).
            // Actually, `formatDuration` returns numbers.

            let displayValue = part.value.toString();
            if (isMultiPart && part !== parts[0]) {
              displayValue = displayValue.padStart(part.maxDigits, "0");
            }

            return `<span class="warning-digits" style="min-width: ${part.maxDigits}ch">${displayValue}</span> ${label}`;
          });

          warningEl.innerHTML = `Speed data is ${htmlParts.join(" ")} old`;
        }
      }
    }, 1000);
  } else {
    setStatus("Geolocation not supported on this device.");
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

  unitBtns = document.querySelectorAll("button.unit");
  if (unitBtns.length === 0) {
    throw new Error("Unit buttons not found");
  }

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
  const storedUnit = localStorage.getItem("speed-unit");
  if (storedUnit === "MPH") {
    currentUnit = Units.MPH;
  } else if (storedUnit === "KPH") {
    currentUnit = Units.KPH;
  } else {
    currentUnit = (storedUnit as Unit) || Units.MPH;
  }

  updateUnitUI();

  // Info/Warning popover logic
  const infoPopoverEl = document.getElementById("info-popover");
  const infoBtnEl = document.querySelector(".info-btn");
  const locationMsgEl = document.getElementById("vibe-location-msg");
  const installInstructionsEl = document.getElementById("install-instructions");
  const iosInstructionsEl = document.getElementById("ios-instructions");
  const androidInstructionsEl = document.getElementById("android-instructions");

  // Track if geolocation has been requested
  let geolocationStarted = false;

  if (infoPopoverEl && "showPopover" in infoPopoverEl) {
    // Show/hide install instructions based on OS
    if (installInstructionsEl) {
      const os = getMobileOS();
      if (!isStandalone()) {
        installInstructionsEl.hidden = false;
        if (os === "ios" && iosInstructionsEl) {
          iosInstructionsEl.hidden = false;
        } else if (os === "android" && androidInstructionsEl) {
          androidInstructionsEl.hidden = false;
        } else {
          // Fallback or show both? User asked for "different instructions... using icons... but no arrows pointing outside".
          // If we are on desktop ("other"), maybe we don't show install instructions?
          // But user might be debugging in desktop browser.
          // Let's show both if "other" to be safe, or neither?
          // User said "optimized for modern iPhones".
          // Let's show both as fallback if we can't detect, so users know it's possible.
          if (iosInstructionsEl) {
            iosInstructionsEl.hidden = false;
          }
          if (androidInstructionsEl) {
            androidInstructionsEl.hidden = false;
          }
        }
      } else {
        installInstructionsEl.hidden = true;
      }
    }

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

      infoPopoverEl.style.setProperty("--exit-x", `${deltaX}px`);
      infoPopoverEl.style.setProperty("--exit-y", `${deltaY}px`);
    };

    // Update on resize
    window.addEventListener("resize", updateExitTarget);

    // Update before opening when triggered by button
    infoBtnEl?.addEventListener("click", updateExitTarget);

    const hasShownInfo = localStorage.getItem("info-popover-shown");
    const shouldShow = !hasShownInfo && !isStandalone();

    // Only show automatically if not previously shown AND not installed as PWA
    if (shouldShow) {
      // Unhide the location permission warning for the first run
      if (locationMsgEl) {
        locationMsgEl.hidden = false;
      }

      (infoPopoverEl as unknown as PopoverElement).showPopover();
      // Calculate immediately, waiting for layout
      requestAnimationFrame(() => updateExitTarget());
    } else {
      // We are not showing it automatically, so pre-calculate the button position
      // to ensure manual clicks animate correctly from the button immediately.
      updateExitTarget();

      // Start immediately if not showing popover
      geolocationStarted = true;
      startGeolocation();
    }

    infoPopoverEl.addEventListener("toggle", (event: Event) => {
      const toggleEvent = event as ToggleEvent;
      if (toggleEvent.newState === "open") {
        updateExitTarget();
      } else if (toggleEvent.newState === "closed") {
        updateExitTarget();

        // Ensure message is hidden for future opens
        if (locationMsgEl) {
          locationMsgEl.hidden = true;
        }

        localStorage.setItem("info-popover-shown", "true");

        // Start geolocation if this was the first close
        if (!geolocationStarted) {
          geolocationStarted = true;

          const onTransitionEnd = (e: TransitionEvent) => {
            if (e.target === infoPopoverEl) {
              infoPopoverEl.removeEventListener(
                "transitionend",
                onTransitionEnd,
              );
              startGeolocation();
            }
          };

          infoPopoverEl.addEventListener("transitionend", onTransitionEnd);
        }
      }
    });
  } else {
    // Fallback if popover not supported/found
    startGeolocation();
  }

  // Unit toggle
  for (const btn of unitBtns) {
    btn.addEventListener("click", () => {
      currentUnit = currentUnit === Units.MPH ? Units.KPH : Units.MPH;
      localStorage.setItem("speed-unit", currentUnit);
      updateUnitUI();
      // Re-render current speed in new units (fallback to 0 if we haven't seen a value)
      if (lastSpeedMs !== null) {
        renderSpeed(lastSpeedMs);
      }
    });
  }

  // Screen wake lock
  keepScreenOnEl.addEventListener("change", handleWakeLock);
  // Re-acquire wake lock on visibility change
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      handleWakeLock();
    }
  });

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

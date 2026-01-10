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
let lastHandlePositionTime: number | null = null;

const GPS_WARMUP_MS = 1000;

export const PLACEHOLDER = "———";

const GITHUB_LINK_HTML = `
  <a
    href="https://github.com/samuel-skean/speedometer"
    target="_blank"
    rel="noopener noreferrer"
    class="github-link fixed-github-link"
    aria-label="View source on GitHub"
  >
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      stroke="currentColor"
      stroke-width="2"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path
        d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
      ></path>
    </svg>
  </a>
`;

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
function renderSpeed(metersPerSecond: number | null): void {
  if (metersPerSecond === null) {
    showPlaceholder();
    return;
  }

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
    ${GITHUB_LINK_HTML}
  `;
}

function renderLocationDenied(): void {
  document.body.innerHTML = `
    <main class="unsupported" role="alert">
      <div class="unsupported__content">
        <p class="unsupported__eyebrow">Location Denied</p>
        <h1>Location services are disabled.</h1>
        <p>
          This app needs access to your location to calculate your speed.
          Please check your browser settings and try again.
        </p>
      </div>
    </main>
    ${GITHUB_LINK_HTML}
  `;
}

function hasNativeSpeedField(): boolean {
  // Allow bypass for testing
  // biome-ignore lint/suspicious/noExplicitAny: Mocking global for testing
  if ((window as any).__TEST_MODE__) {
    return true;
  }

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
  // Allow bypass for testing
  // biome-ignore lint/suspicious/noExplicitAny: Mocking global for testing
  if ((window as any).__TEST_MODE__) {
    return true;
  }

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
  const now = Date.now();

  if (lastHandlePositionTime !== null) {
    const elapsed = now - lastHandlePositionTime;
    if (elapsed > 1500) {
      console.warn(`Time between handlePosition calls: ${elapsed}ms`);
    }
  }
  lastHandlePositionTime = now;

  const { speed, accuracy } = pos.coords;

  // Update speed only when native speed is provided and valid OR null
  if (
    speed === null ||
    (typeof speed === "number" && Number.isFinite(speed) && speed >= 0)
  ) {
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
      renderLocationDenied();
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

          const isMultiPart = parts.length > 1;
          const htmlParts = parts.map((part) => {
            const label = isMultiPart
              ? part.unit[0]
              : part.value === 1
                ? part.unit
                : `${part.unit}s`;

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
  lastHandlePositionTime = null;
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
  const scrollOverlayEl = document.querySelector(".scroll-overlay");
  const infoContentEl = document.querySelector(".info-content");

  // Track if geolocation has been requested
  let geolocationStarted = false;

  // Function to update the scroll overlay visibility
  const updateScrollOverlay = () => {
    if (!infoContentEl || !scrollOverlayEl) {
      return;
    }

    const { scrollHeight, clientHeight, scrollTop } = infoContentEl;
    const isScrollable = scrollHeight > clientHeight;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;

    if (isScrollable && !isAtBottom) {
      scrollOverlayEl.classList.add("visible");
    } else {
      scrollOverlayEl.classList.remove("visible");
    }
  };

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
    window.addEventListener("resize", () => {
      updateExitTarget();
      updateScrollOverlay();
    });

    // Update before opening when triggered by button
    infoBtnEl?.addEventListener("click", updateExitTarget);

    // Attach scroll listener
    infoContentEl?.addEventListener("scroll", updateScrollOverlay);

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
        // Check scroll overlay after a short delay to allow layout to settle if needed,
        // or immediately if possible.
        // Since popover is top layer, layout might happen immediately.
        requestAnimationFrame(() => updateScrollOverlay());
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

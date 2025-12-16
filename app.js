/**
 * Basic speedometer using the Geolocation API, simplified.
 * - Uses ONLY native position.coords.speed (m/s).
 * - No distance/time fallback when speed is unavailable.
 * - Displays speed centered on screen; unit toggle between mph and km/h.
 */

// Elements
const speedEl = document.getElementById("speed");
const unitEl = document.getElementById("unit");
const statusEl = document.getElementById("status");
const unitToggleBtn = document.getElementById("unitToggle");

// Units and conversion
const Units = {
  MPH: "mph",
  KPH: "km/h",
};
const MPS_TO_MPH = 2.2369362920544;
const MPS_TO_KPH = 3.6;

// State
let currentUnit = localStorage.getItem("speed-unit") || Units.MPH;
let lastSpeedMs = null; // last known native speed (m/s), if any

// UI setup
function updateUnitUI() {
  unitEl.textContent = currentUnit;
  unitToggleBtn.textContent = currentUnit;
}
updateUnitUI();

// Unit toggle
unitToggleBtn.addEventListener("click", () => {
  currentUnit = currentUnit === Units.MPH ? Units.KPH : Units.MPH;
  localStorage.setItem("speed-unit", currentUnit);
  updateUnitUI();

  // Re-render current speed in new units (fallback to 0 if we haven't seen a value)
  renderSpeed(lastSpeedMs ?? 0);
});

// Render the speed (expects m/s)
function renderSpeed(ms) {
  const msValue = Number.isFinite(ms) && ms >= 0 ? ms : 0;
  const value = currentUnit === Units.MPH ? msValue * MPS_TO_MPH : msValue * MPS_TO_KPH;

  const clamped = Math.min(Math.max(value, 0), 999);
  const rounded = Math.round(clamped);
  speedEl.textContent = String(rounded);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function handlePosition(pos) {
  const { speed, accuracy } = pos.coords;

  // Update speed only when native speed is provided and valid
  if (Number.isFinite(speed) && speed >= 0) {
    lastSpeedMs = speed;
    renderSpeed(speed);
  }

  // Status/accuracy
  if (Number.isFinite(accuracy)) {
    setStatus(`Accuracy: ±${Math.round(accuracy)}m`);
  } else {
    setStatus("GPS fix acquired");
  }
}

function handleError(err) {
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

// Initialize display to 0 until we get a valid speed
renderSpeed(0);

// Request high-accuracy GPS and frequent updates
const watchOptions = {
  enableHighAccuracy: true,
  maximumAge: 1000, // accept 1s old cached positions
  timeout: 10000, // 10s per fix
};

if ("geolocation" in navigator) {
  setStatus("Requesting GPS...");
  navigator.geolocation.watchPosition(handlePosition, handleError, watchOptions);
} else {
  setStatus("Geolocation not supported on this device.");
}

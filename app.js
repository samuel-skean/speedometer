/**
 * Basic speedometer using the Geolocation API.
 * - Prefers native position.coords.speed (m/s) when available.
 * - Falls back to computing speed via Haversine distance over time.
 * - Displays speed centered on screen; unit toggle between mph and km/h.
 */

const speedEl = document.getElementById("speed");
const unitEl = document.getElementById("unit");
const statusEl = document.getElementById("status");
const unitToggleBtn = document.getElementById("unitToggle");

const Units = {
  MPH: "mph",
  KPH: "km/h",
};

let currentUnit = localStorage.getItem("speed-unit") || Units.MPH;
unitEl.textContent = currentUnit;
unitToggleBtn.textContent = currentUnit;

unitToggleBtn.addEventListener("click", () => {
  currentUnit = currentUnit === Units.MPH ? Units.KPH : Units.MPH;
  localStorage.setItem("speed-unit", currentUnit);
  unitEl.textContent = currentUnit;
  unitToggleBtn.textContent = currentUnit;

  // Re-render current speed in new units if we have a last value
  if (lastComputedSpeed != null) {
    speedEl.textContent = formatSpeed(lastComputedSpeed);
  }
});

function formatSpeed(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const value = currentUnit === Units.MPH ? ms * 2.2369362920544 : ms * 3.6;
  const rounded =
    value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return String(rounded);
}

// Haversine distance in meters between two lat/lon coords
function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000; // Earth radius (m)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let lastFix = null; // { lat, lon, ts }
let lastComputedSpeed = null; // meters per second

function updateSpeed(ms) {
  lastComputedSpeed = ms;
  speedEl.textContent = formatSpeed(ms);
}

function setStatus(text) {
  statusEl.textContent = text;
}

function handlePosition(pos) {
  const { latitude, longitude, speed, accuracy } = pos.coords;
  const ts = pos.timestamp;

  // Prefer native speed if provided (m/s). Some platforms return null.
  if (speed != null) {
    const validNative = Number.isFinite(speed) && speed >= 0;
    updateSpeed(validNative ? speed : lastComputedSpeed);
  } else if (lastFix) {
    const dtMs = ts - lastFix.ts;
    if (dtMs > 0) {
      const distM = haversineMeters(
        lastFix.lat,
        lastFix.lon,
        latitude,
        longitude,
      );
      const ms = distM / (dtMs / 1000);

      // Filter unrealistic spikes (e.g., GPS jumps)
      const maxHumanSpeedMs = 100; // ~224 mph
      const reasonable =
        Number.isFinite(ms) && ms >= 0 && ms <= maxHumanSpeedMs;

      updateSpeed(reasonable ? ms : lastComputedSpeed);
    }
  } else {
    // First fix—no speed available yet without native speed
    // Leave the display as is
  }

  lastFix = { lat: latitude, lon: longitude, ts };
  if (accuracy != null && Number.isFinite(accuracy)) {
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

// Request high-accuracy GPS and frequent updates
const watchOptions = {
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

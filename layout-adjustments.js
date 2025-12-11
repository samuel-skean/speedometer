/**
 * layout-adjustments.js
 *
 * Sets a CSS variable (--status-top-offset) used to position the #status element
 * accounting for device safe areas (notches, status bars). The value is expressed
 * using CSS env(safe-area-inset-top) so the actual inset is resolved by the browser.
 *
 * This script is intentionally not wrapped in an IIFE. It exposes a small API on
 * window.LayoutAdjustments and initializes itself when the DOM is ready.
 */

function getSafeAreaTopOffset() {
  // Use a small spacing below the safe area to avoid visual overlap with OS UI.
  return "calc(env(safe-area-inset-top) + 8px)";
}

/**
 * Apply the offset to the root element as a CSS variable.
 */
function updateStatusOffset() {
  document.documentElement.style.setProperty(
    "--status-top-offset",
    getSafeAreaTopOffset(),
  );
}

/**
 * Initialize and set up listeners to keep the offset fresh across viewport changes.
 */
function initLayoutAdjustments() {
  updateStatusOffset();

  // Recalculate on window resize and orientation changes
  window.addEventListener("resize", updateStatusOffset, { passive: true });
  window.addEventListener("orientationchange", updateStatusOffset, {
    passive: true,
  });

  // If visualViewport is available, recalc when browser UI collapses/expands
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateStatusOffset, {
      passive: true,
    });
  }
}

// Auto-init when DOM is ready
if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  initLayoutAdjustments();
} else {
  document.addEventListener("DOMContentLoaded", initLayoutAdjustments, {
    once: true,
  });
}

// Expose API globally
window.LayoutAdjustments = {
  updateStatusOffset,
  initLayoutAdjustments,
};

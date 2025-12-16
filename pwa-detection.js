/**
 * pwa-detection.js
 *
 * Detects when the app is running as an installed PWA and toggles a "pwa-installed"
 * class on <body>. Applies the class as early as possible to avoid
 * layout flicker and keeps it in sync across lifecycle events.
 *
 * This script does not use an IIFE; it exposes a global `PWADetection` object
 * and initializes immediately.
 * Human edit: Lol at the above paragraph. But I'm done fighting it, it seems to work.
 */

((global) => {
  const supportsMatchMedia = typeof window !== "undefined" && typeof window.matchMedia === "function";

  const PWADetection = {
    /**
     * Returns true if the app is running as an installed PWA.
     *
     * Checks:
     * - CSS display-mode: standalone/minimal-ui/fullscreen (Chromium-based, some others)
     * - iOS Safari: navigator.standalone
     * - iOS heuristic: near-equal innerHeight and outerHeight suggesting no browser chrome
     */
    isPwaInstalled() {
      // Standard display-mode checks
      const standalone = supportsMatchMedia && window.matchMedia("(display-mode: standalone)").matches;
      const minimalUi = supportsMatchMedia && window.matchMedia("(display-mode: minimal-ui)").matches;
      const fullscreen = supportsMatchMedia && window.matchMedia("(display-mode: fullscreen)").matches;

      // iOS-specific checks
      const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
      const isiOS = /iPhone|iPad|iPod/i.test(ua);
      const hasStandaloneFlag = typeof navigator !== "undefined" && "standalone" in navigator;
      const iOSStandalone = hasStandaloneFlag && navigator.standalone === true;

      // Heuristic for iOS fullscreen (no browser chrome)
      const viewportNoChrome =
        typeof window !== "undefined" &&
        isiOS &&
        typeof window.innerHeight === "number" &&
        typeof window.outerHeight === "number" &&
        Math.abs(window.outerHeight - window.innerHeight) <= 2;

      return !!(standalone || minimalUi || fullscreen || iOSStandalone || viewportNoChrome);
    },

    /**
     * Adds or removes the "pwa-installed" class on <body> based on detection.
     */
    applyPwaClass() {
      const body = document.body;
      if (!body) return;

      if (PWADetection.isPwaInstalled()) {
        body.classList.add("pwa-installed");
      } else {
        body.classList.remove("pwa-installed");
      }
    },

    /**
     * Listen for display-mode changes (supported on some browsers) and re-apply the class.
     */
    setupDisplayModeListener() {
      if (!supportsMatchMedia) return;
      const mq = window.matchMedia("(display-mode: standalone)");

      // Modern API
      if (mq && typeof mq.addEventListener === "function") {
        mq.addEventListener("change", PWADetection.applyPwaClass);
      }
      // Legacy API
      else if (mq && typeof mq.addListener === "function") {
        mq.addListener(PWADetection.applyPwaClass);
      }
    },

    /**
     * Initialize detection: apply the class immediately and set up listeners.
     * Called right away and again on DOMContentLoaded to minimize layout flicker.
     */
    init() {
      // Apply ASAP if DOM is available to minimize flicker
      if (document.body) {
        PWADetection.applyPwaClass();
      }

      const run = () => {
        PWADetection.applyPwaClass();
        PWADetection.setupDisplayModeListener();

        // Keep in sync across visibility and navigation lifecycle
        document.addEventListener("visibilitychange", PWADetection.applyPwaClass);
        window.addEventListener("pageshow", PWADetection.applyPwaClass);
        window.addEventListener("orientationchange", PWADetection.applyPwaClass);
        window.addEventListener("resize", PWADetection.applyPwaClass);
      };

      if (document.readyState === "interactive" || document.readyState === "complete") {
        run();
      } else {
        document.addEventListener("DOMContentLoaded", run, { once: true });
      }
    },
  };

  // Export and initialize immediately
  global.PWADetection = PWADetection;
  PWADetection.init();
})(window);

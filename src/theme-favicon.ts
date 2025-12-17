/**
 * Theme-aware favicon swapping using PNGs and explicit sizes for Firefox compatibility.
 *
 * This module:
 * - Uses PNG favicons (16x16 and 32x32) instead of SVG.
 * - Includes sizes on link elements and avoids type to satisfy Firefox.
 * - Listens to prefers-color-scheme changes and updates the tab icon without reload.
 * - Re-applies on visibilitychange when returning to a tab.
 *
 * Default paths:
 *   - Dark:  icons/generated/dark/icon-16.png, icons/generated/dark/icon-32.png
 *   - Light: icons/generated/light/icon-16.png, icons/generated/light/icon-32.png
 *
 * Usage:
 *   Import this file once at startup; it auto-initializes. Or call setupThemePngFavicons() with custom options.
 *
 * Note: This only affects the tab favicon. PWA manifest icons and iOS home-screen icons remain static after install.
 */
type Mode = "light" | "dark";

export type PngFavicon = { href: string; sizes: "16x16" | "32x32" };

export type ThemePngFaviconOptions = {
  lightIcons?: PngFavicon[]; // default: 16 and 32 light PNGs
  darkIcons?: PngFavicon[]; // default: 16 and 32 dark PNGs
  // Optional cache-buster: appended as ?v=<value> to ensure UI refresh.
  cacheBuster?: string | (() => string);
};

type Controller = {
  dispose: () => void;
  setMode: (mode: Mode) => void;
  setIcons: (icons: {
    lightIcons?: PngFavicon[];
    darkIcons?: PngFavicon[];
  }) => void;
};

const DEFAULT_LIGHT: PngFavicon[] = [
  { href: "/icons/generated/light/icon-32.png", sizes: "32x32" },
];

const DEFAULT_DARK: PngFavicon[] = [
  { href: "/icons/generated/dark/icon-32.png", sizes: "32x32" },
];

let controllerSingleton: Controller | null = null;

function isBrowserEnv(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function currentMode(): Mode {
  if (!isBrowserEnv()) return "dark";
  const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
  return mql?.matches ? "dark" : "light";
}

function buildCacheBustedHref(
  baseHref: string,
  mode: Mode,
  cacheBuster?: string | (() => string),
): string {
  let suffix: string;
  if (typeof cacheBuster === "function") {
    try {
      suffix = String(cacheBuster());
    } catch {
      suffix = mode;
    }
  } else if (typeof cacheBuster === "string" && cacheBuster.length > 0) {
    suffix = cacheBuster;
  } else {
    suffix = mode;
  }
  const join = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${join}v=${encodeURIComponent(suffix)}`;
}

/**
 * Replace existing favicon link elements and insert new ones.
 * Removes any link elements with rel containing "icon", but keeps apple-touch-icon links intact.
 */
function replacePngFavicons(
  set: PngFavicon[],
  cacheBuster?: string | (() => string),
) {
  if (!isBrowserEnv()) return;

  // Remove existing favicon links (do not touch apple-touch-icon).
  document
    .querySelectorAll('link[rel~="icon"]:not([rel~="apple-touch-icon"])')
    .forEach((el) => el.parentElement?.removeChild(el));

  // Pick a single 32x32 PNG favicon for maximum Firefox compatibility.
  const pick = set.find((i) => i.sizes === "32x32") ?? set[0];
  if (!pick) return;

  const href = pick.href;

  // Firefox workaround: briefly set a data URI favicon to force UI refresh, then set the real one.
  // Transparent 32x32 PNG (base64) to minimize flashes.
  const transparentPng32 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAUUlEQVRYhe3SMQEAIAzDsKf9b0YqI0QpQe2xwEwC6P8uQFfKJkUAAAAAAADw0bIYwCwAAAAAAABgqfYpAAAAAAAAAMC8CAAAAAAAAAAAAP8GgCkQy3c9c2Gk7wAAAABJRU5ErkJggg==";

  const temp = document.createElement("link");
  temp.rel = "icon";
  temp.type = "image/png";
  temp.sizes = "32x32";
  temp.href = transparentPng32;
  document.head.appendChild(temp);

  // Replace temp with actual icons (both rel types) to maximize compatibility.
  // First remove temp to avoid duplicates.
  temp.parentElement?.removeChild(temp);

  const link1 = document.createElement("link");
  link1.rel = "icon";
  link1.type = "image/png";
  link1.sizes = "32x32";
  link1.href = href;
  document.head.appendChild(link1);

  const link2 = document.createElement("link");
  link2.rel = "shortcut icon";
  link2.type = "image/png";
  link2.sizes = "32x32";
  link2.href = href;
  document.head.appendChild(link2);
}

function createController(opts?: ThemePngFaviconOptions): Controller {
  let lightIcons = opts?.lightIcons ?? DEFAULT_LIGHT;
  let darkIcons = opts?.darkIcons ?? DEFAULT_DARK;
  const cacheBuster = opts?.cacheBuster;

  const mql = isBrowserEnv()
    ? window.matchMedia?.("(prefers-color-scheme: dark)")
    : null;

  let mode: Mode = "light";

  function apply(modeToApply: Mode) {
    const set = modeToApply === "dark" ? darkIcons : lightIcons;
    replacePngFavicons(set, cacheBuster);
  }

  function setMode(next: Mode) {
    mode = next;
    apply(mode);
  }

  function setIcons(next: {
    lightIcons?: PngFavicon[];
    darkIcons?: PngFavicon[];
  }) {
    if (next.lightIcons) lightIcons = next.lightIcons;
    if (next.darkIcons) darkIcons = next.darkIcons;
    apply(mode);
  }

  // Initial application
  apply(mode);

  const mqlHandler = (e: MediaQueryListEvent | MediaQueryList) => {
    const isDark = "matches" in e ? e.matches : (e as MediaQueryList).matches;
    setMode(isDark ? "dark" : "light");
  };

  // Listen for scheme changes
  if (mql) {
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", mqlHandler as (ev: Event) => void);
    } else if (typeof mql.addListener === "function") {
      // Safari < 14
      mql.addListener(
        mqlHandler as (this: MediaQueryList, ev: MediaQueryListEvent) => void,
      );
    }
  }

  // Re-apply when page becomes visible (helps some browsers refresh UI icon)
  const visHandler = () => {
    if (!document.hidden) apply(mode);
  };
  if (isBrowserEnv()) {
    document.addEventListener("visibilitychange", visHandler);
  }

  function dispose() {
    if (mql) {
      if (typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", mqlHandler as (ev: Event) => void);
      } else if (typeof mql.removeListener === "function") {
        mql.removeListener(
          mqlHandler as (this: MediaQueryList, ev: MediaQueryListEvent) => void,
        );
      }
    }
    if (isBrowserEnv()) {
      document.removeEventListener("visibilitychange", visHandler);
    }
  }

  return { dispose, setMode, setIcons };
}

/**
 * Public API: initialize the theme-aware PNG favicon swapping.
 */
export function setupThemePngFavicons(
  options?: ThemePngFaviconOptions,
): Controller {
  if (!isBrowserEnv()) {
    // No-op controller for SSR or non-browser contexts.
    return {
      dispose: () => {},
      setMode: () => {},
      setIcons: () => {},
    };
  }

  if (controllerSingleton) return controllerSingleton;
  controllerSingleton = createController(options);
  return controllerSingleton;
}

// Auto-initialize with defaults on module import in the browser.
if (isBrowserEnv()) {
  setupThemePngFavicons();
}

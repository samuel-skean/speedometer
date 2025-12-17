/**
 * wake-lock.ts
 *
 * Manages the Screen Wake Lock API to keep the screen alive while the app is running.
 * Handles requesting wake lock, automatic re-acquisition on visibility changes,
 * and graceful fallback for browsers that don't support the API.
 */

export class WakeLockManager {
  private wakeLock: WakeLockSentinel | null = null;
  private isSupported: boolean;
  private onStatusChange?: (message: string) => void;
  private visibilityChangeHandler: (() => void) | null = null;

  constructor(onStatusChange?: (message: string) => void) {
    this.isSupported = WakeLockManager.isSupported();
    this.onStatusChange = onStatusChange;
  }

  /**
   * Request a screen wake lock to keep the display on.
   */
  async requestWakeLock(): Promise<void> {
    if (!this.isSupported) {
      this.notifyStatus("Wake Lock not supported on this device");
      return;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      this.notifyStatus("Screen will stay awake");

      // Re-acquire wake lock if it's released (e.g., tab becomes hidden and visible again)
      this.wakeLock.addEventListener("release", () => {
        this.notifyStatus("Screen wake lock released");
        this.wakeLock = null;
      });
    } catch (err) {
      // Common errors:
      // - NotAllowedError: page not visible or other permission issue
      // - NotSupportedError: wake lock not supported
      if (err instanceof Error) {
        console.warn("Wake Lock request failed:", err.message);
        if (err.name === "NotAllowedError") {
          this.notifyStatus("Wake Lock denied (page not visible?)");
        } else {
          this.notifyStatus(`Wake Lock unavailable: ${err.name}`);
        }
      }
    }
  }

  /**
   * Release the current wake lock if active.
   */
  async releaseWakeLock(): Promise<void> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        this.notifyStatus("Screen wake lock released");
      } catch (err) {
        console.warn("Wake Lock release failed:", err);
      }
    }
  }

  /**
   * Initialize wake lock handling with automatic re-acquisition on visibility change.
   */
  init(): void {
    if (!this.isSupported) {
      this.notifyStatus("Wake Lock not supported on this device");
      return;
    }

    // Request wake lock on initial load
    this.requestWakeLock();

    // Re-acquire wake lock when page becomes visible again
    this.visibilityChangeHandler = () => {
      if (document.visibilityState === "visible" && !this.wakeLock) {
        this.requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", this.visibilityChangeHandler);
  }

  /**
   * Clean up resources and remove event listeners.
   */
  cleanup(): void {
    if (this.visibilityChangeHandler) {
      document.removeEventListener(
        "visibilitychange",
        this.visibilityChangeHandler,
      );
      this.visibilityChangeHandler = null;
    }
    this.releaseWakeLock();
  }

  private notifyStatus(message: string): void {
    if (this.onStatusChange) {
      this.onStatusChange(message);
    }
  }

  /**
   * Check if Wake Lock API is supported in this browser.
   */
  static isSupported(): boolean {
    return "wakeLock" in navigator;
  }
}

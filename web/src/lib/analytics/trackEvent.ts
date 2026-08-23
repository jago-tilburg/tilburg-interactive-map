declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Mirrors the monolith's trackEvent(): a thin, guarded wrapper around GA4's
// gtag() so every call site doesn't need its own "is analytics loaded" check.
// A no-op until the gtag.js snippet is added to the app (not done yet —
// GA4 wiring is still unported), same as it would be if GA4 were blocked.
export function trackEvent(eventName: string, params: Record<string, unknown> = {}): void {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}

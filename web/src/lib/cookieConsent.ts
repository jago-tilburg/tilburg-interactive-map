const COOKIE_CONSENT_KEY = "tilburg-cookie-consent";

interface StoredConsent {
  necessary: true;
  analytics: boolean;
}

// The pre-2026-09-02 value written before consent had categories was just
// the plain string "true" — read as "necessary only, no analytics" so an
// existing dismissal isn't silently forgotten (the banner would otherwise
// reappear for everyone who already dismissed it) while never granting
// analytics consent nobody actually gave.
function readConsent(): StoredConsent | null {
  const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  if (raw === null) return null;
  if (raw === "true") return { necessary: true, analytics: false };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    return { necessary: true, analytics: parsed.analytics === true };
  } catch {
    return null;
  }
}

export function hasCookieConsent(): boolean {
  return readConsent() !== null;
}

// Gates GA4 script loading (see layout.tsx) — separate from
// hasCookieConsent() because "seen the banner" and "opted into analytics"
// are two different questions once there's a reject-analytics option.
export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true;
}

export function acceptNecessaryOnly(): void {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ necessary: true, analytics: false }));
}

export function acceptAll(): void {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ necessary: true, analytics: true }));
}

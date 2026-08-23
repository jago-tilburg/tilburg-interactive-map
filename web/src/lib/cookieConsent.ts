const COOKIE_CONSENT_KEY = "tilburg-cookie-consent";

export function hasCookieConsent(): boolean {
  return window.localStorage.getItem(COOKIE_CONSENT_KEY) === "true";
}

export function acceptCookies(): void {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, "true");
}

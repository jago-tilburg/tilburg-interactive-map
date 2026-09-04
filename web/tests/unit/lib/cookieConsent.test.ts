import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  hasCookieConsent,
  hasAnalyticsConsent,
  acceptNecessaryOnly,
  acceptAll,
  subscribeToConsentChange,
} from "@/lib/cookieConsent";

beforeEach(() => {
  window.localStorage.clear();
});

describe("hasCookieConsent", () => {
  it("returns false when nothing is stored", () => {
    expect(hasCookieConsent()).toBe(false);
  });

  it("returns true after acceptNecessaryOnly()", () => {
    acceptNecessaryOnly();
    expect(hasCookieConsent()).toBe(true);
  });

  it("returns true after acceptAll()", () => {
    acceptAll();
    expect(hasCookieConsent()).toBe(true);
  });

  it("treats the pre-categories plain 'true' value as consent given", () => {
    window.localStorage.setItem("tilburg-cookie-consent", "true");
    expect(hasCookieConsent()).toBe(true);
  });

  it("treats invalid stored JSON as no consent", () => {
    window.localStorage.setItem("tilburg-cookie-consent", "{not json");
    expect(hasCookieConsent()).toBe(false);
  });
});

describe("hasAnalyticsConsent", () => {
  it("returns false when nothing is stored", () => {
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("returns false after acceptNecessaryOnly()", () => {
    acceptNecessaryOnly();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("returns true after acceptAll()", () => {
    acceptAll();
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("treats the pre-categories plain 'true' value as necessary-only, no analytics", () => {
    window.localStorage.setItem("tilburg-cookie-consent", "true");
    expect(hasAnalyticsConsent()).toBe(false);
  });
});

describe("subscribeToConsentChange", () => {
  it("fires its callback when acceptAll() is called", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToConsentChange(callback);
    acceptAll();
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("fires its callback when acceptNecessaryOnly() is called", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToConsentChange(callback);
    acceptNecessaryOnly();
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("stops firing once unsubscribed", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToConsentChange(callback);
    unsubscribe();
    acceptAll();
    expect(callback).not.toHaveBeenCalled();
  });
});

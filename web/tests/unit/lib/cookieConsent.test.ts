import { describe, it, expect, beforeEach } from "vitest";
import { hasCookieConsent, acceptCookies } from "@/lib/cookieConsent";

beforeEach(() => {
  window.localStorage.clear();
});

describe("hasCookieConsent", () => {
  it("returns false when nothing is stored", () => {
    expect(hasCookieConsent()).toBe(false);
  });

  it("returns true after acceptCookies() is called", () => {
    acceptCookies();
    expect(hasCookieConsent()).toBe(true);
  });
});

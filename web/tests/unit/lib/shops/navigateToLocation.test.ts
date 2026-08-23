import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildNavigationUrl, navigateToLocation } from "@/lib/shops/navigateToLocation";

const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)";
const ANDROID_UA = "Mozilla/5.0 (Linux; Android 14)";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";

describe("buildNavigationUrl", () => {
  it("builds an iOS maps:// URL", () => {
    expect(buildNavigationUrl(51.5, 5.09, "Test Shop", IOS_UA)).toBe(
      "maps://maps.google.com/maps?daddr=51.5,5.09",
    );
  });

  it("builds an Android geo: URL with the shop name encoded", () => {
    expect(buildNavigationUrl(51.5, 5.09, "Test Shop", ANDROID_UA)).toBe(
      "geo:51.5,5.09?q=51.5,5.09(Test%20Shop)",
    );
  });

  it("builds a Google Maps web directions URL for desktop", () => {
    expect(buildNavigationUrl(51.5, 5.09, "Test Shop", DESKTOP_UA)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=51.5,5.09",
    );
  });
});

describe("navigateToLocation", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;
  let gtag: (...args: unknown[]) => void;

  beforeEach(() => {
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    gtag = vi.fn();
    window.gtag = gtag;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks the navigation event and opens the built URL", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(DESKTOP_UA);

    navigateToLocation(51.5, 5.09, "Test Shop");

    expect(gtag).toHaveBeenCalledWith(
      "event",
      "navigate_to_shop",
      { shop_name: "Test Shop", latitude: 51.5, longitude: 5.09 },
    );
    expect(openSpy).toHaveBeenCalledWith(
      "https://www.google.com/maps/dir/?api=1&destination=51.5,5.09",
      "_blank",
    );
  });

  it("falls back to the https:// maps URL on iOS after a delay", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(IOS_UA);
    const assignSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, assign: assignSpy },
      writable: true,
      configurable: true,
    });

    navigateToLocation(51.5, 5.09, "Test Shop");
    vi.advanceTimersByTime(500);

    expect(assignSpy).toHaveBeenCalledWith("https://maps.google.com/maps?daddr=51.5,5.09");

    Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
  });

  it("does not schedule the iOS fallback on other platforms", () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(DESKTOP_UA);
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");

    navigateToLocation(51.5, 5.09, "Test Shop");

    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});

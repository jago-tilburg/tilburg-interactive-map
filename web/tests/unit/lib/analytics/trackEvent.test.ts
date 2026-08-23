import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackEvent } from "@/lib/analytics/trackEvent";

beforeEach(() => {
  delete (window as { gtag?: unknown }).gtag;
});

describe("trackEvent", () => {
  it("calls window.gtag with the GA4 event shape when gtag is loaded", () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    trackEvent("view_shop", { shop_id: 1 });

    expect(gtag).toHaveBeenCalledWith("event", "view_shop", { shop_id: 1 });
  });

  it("defaults params to an empty object", () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    trackEvent("open_menu");

    expect(gtag).toHaveBeenCalledWith("event", "open_menu", {});
  });

  it("does nothing when gtag is not loaded", () => {
    expect(() => trackEvent("view_shop")).not.toThrow();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";

const hasAnalyticsConsent = vi.fn();
// Captures the callback useSyncExternalStore registers, so tests can fire
// it directly to simulate acceptAll() being called elsewhere in the same
// tab (the exact case the real subscribeToConsentChange exists for — see
// GoogleAnalytics.tsx's doc comment) without needing a real DOM event round
// trip.
let consentChangeCallback: (() => void) | null = null;
const subscribeToConsentChange = vi.fn((callback: () => void) => {
  consentChangeCallback = callback;
  return () => {
    consentChangeCallback = null;
  };
});
vi.mock("@/lib/cookieConsent", () => ({
  hasAnalyticsConsent: () => hasAnalyticsConsent(),
  subscribeToConsentChange: (callback: () => void) => subscribeToConsentChange(callback),
}));

// next/script's real component defers insertion outside the React tree
// (tied to Next's own runtime script-loading strategy), so it renders
// nothing inspectable via RTL's container — mocked here as a plain <script>
// so the tests can assert on what GoogleAnalytics actually passed it.
vi.mock("next/script", () => ({
  default: ({ src, id, children }: { src?: string; id?: string; children?: string }) => (
    // eslint-disable-next-line @next/next/no-sync-scripts -- test-only stand-in for next/script, not a real page script
    <script src={src} id={id}>
      {children}
    </script>
  ),
}));

import { GoogleAnalytics } from "@/components/common/GoogleAnalytics";

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

beforeEach(() => {
  vi.clearAllMocks();
  consentChangeCallback = null;
});

afterEach(() => {
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = ORIGINAL_ENV;
});

describe("GoogleAnalytics", () => {
  it("renders nothing when no measurement id is configured, even with consent", () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    hasAnalyticsConsent.mockReturnValue(true);
    const { container } = render(<GoogleAnalytics />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when a measurement id is configured but analytics consent wasn't given", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST123";
    hasAnalyticsConsent.mockReturnValue(false);
    const { container } = render(<GoogleAnalytics />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the gtag scripts once both a measurement id is configured and analytics consent was given", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST123";
    hasAnalyticsConsent.mockReturnValue(true);
    const { container } = render(<GoogleAnalytics />);
    expect(container.querySelector('script[src*="G-TEST123"]')).toBeTruthy();
    expect(container.textContent).toContain("gtag('config', 'G-TEST123')");
  });

  it("starts collection in the same session once consent changes, without a page reload", () => {
    // The exact bug found live on staging 2026-09-04: consent granted after
    // this component already rendered (with the old no-op subscription)
    // never started collection until a full reload. subscribeToConsentChange
    // firing its callback is what a real acceptAll() call does now.
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST123";
    hasAnalyticsConsent.mockReturnValue(false);
    const { container } = render(<GoogleAnalytics />);
    expect(container).toBeEmptyDOMElement();

    hasAnalyticsConsent.mockReturnValue(true);
    act(() => {
      consentChangeCallback?.();
    });

    expect(container.querySelector('script[src*="G-TEST123"]')).toBeTruthy();
  });
});

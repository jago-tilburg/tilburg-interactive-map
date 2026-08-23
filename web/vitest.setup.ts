import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement matchMedia at all (throws "not a function"), so
// every component using it (e.g. useIsMobile) needs a global stub here
// rather than each test file reinventing one. Defaults to "no match" —
// individual tests override window.matchMedia when they need to simulate a
// specific breakpoint.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

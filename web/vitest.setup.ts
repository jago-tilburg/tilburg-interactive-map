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

// jsdom doesn't implement ResizeObserver either — Radix's Switch (and any
// other primitive using @radix-ui/react-use-size) reads it during mount to
// measure itself, so anything rendering a Switch throws "ResizeObserver is
// not defined" without this.
if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

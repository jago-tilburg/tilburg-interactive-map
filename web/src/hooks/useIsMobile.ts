import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 768px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

// SSR-safe viewport-width check (768px, matching the prototype's primary
// breakpoint). Renders as "desktop" for the server pass and the initial
// client (pre-hydration) pass to avoid a hydration mismatch, then swaps to
// the real value after mount — same pattern as the anon-id/cookie-consent
// reads elsewhere in this app.
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    /* v8 ignore next -- getServerSnapshot only runs during an actual server render or the
       initial hydration pass; RTL's render() does neither, so this is never invoked here. */
    () => false,
  );
}

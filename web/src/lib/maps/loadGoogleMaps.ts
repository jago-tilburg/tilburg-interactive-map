declare global {
  interface Window {
    google?: typeof google;
  }
}

let loadPromise: Promise<void> | null = null;

// Loads the Google Maps JS API script once and caches the in-flight/settled
// promise, so multiple ShopMap mounts (or re-renders) never inject the
// script twice. Mirrors the monolith's <script src="...maps/api/js?...">
// tag, but Promise-based so a React effect can await readiness.
export function loadGoogleMaps(apiKey: string): Promise<void> {
  /* v8 ignore next 3 -- SSR guard; jsdom always provides `window` under test. */
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadGoogleMaps can only run in the browser"));
  }
  if (window.google?.maps) {
    return Promise.resolve();
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    // Deliberately no loading=async param: that switches the API into a mode
    // where google.maps.Map/Marker/etc. aren't populated as synchronous
    // globals until you call google.maps.importLibrary() yourself. ShopMap
    // constructs them directly (matching the monolith), so this needs the
    // traditional callback-style load where the whole google.maps namespace
    // is ready synchronously once the script's onload fires.
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load the Google Maps script"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

// Test-only: clears the cached promise so each test starts from a clean slate.
export function _resetGoogleMapsLoaderForTests(): void {
  loadPromise = null;
}

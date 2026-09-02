declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

let loadPromise: Promise<void> | null = null;

// Loads Instagram's embed.js once and caches the in-flight/settled promise —
// mirrors loadGoogleMaps.ts. Called from InstagramEmbed.tsx on every
// viewport, so the post plays inline instead of linking out to Instagram.
export function loadInstagramEmbed(): Promise<void> {
  /* v8 ignore next 3 -- SSR guard; jsdom always provides `window` under test. */
  if (typeof window === "undefined") {
    return Promise.reject(new Error("loadInstagramEmbed can only run in the browser"));
  }
  if (window.instgrm) {
    return Promise.resolve();
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.instagram.com/embed.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load the Instagram embed script"));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

// Test-only: clears the cached promise so each test starts from a clean slate.
export function _resetInstagramEmbedLoaderForTests(): void {
  loadPromise = null;
}

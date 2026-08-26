// Literal port of the prototype's "val uit de lucht" marker animation
// (events-map-prototype/2happies-local.html — createShopMarker/
// createEventMarker plus the staging block in renderMarkersImmediate).
// These are MARKER_TUNING_DEFAULTS' drop values, i.e. what a visitor with no
// saved dev-panel tuning actually sees.
export const DROP_DURATION_MS = 500;
export const DROP_STAGGER_MS = 40;
export const DROP_BATCH_SIZE = 2;

// The prototype's renderMarkers() debounces 100ms before rendering. That
// debounce is load-bearing here, not incidental: shops come from RTDB and
// events from Firestore, so they arrive a moment apart, and only a
// collection window puts them in the SAME queue — which is what makes them
// fall mixed together instead of every shop first and every event after.
export const DROP_COLLECT_MS = 100;

// Degrees of latitude above the viewport's north edge to start from. The
// fallback is used only when the map has no bounds yet (it hasn't finished
// its first layout), where there's no north edge to measure against.
const START_ABOVE_BOUNDS = 0.03;
const START_ABOVE_FALLBACK = 0.12;

// Markers begin above the top edge of the visible map and ease down to their
// real position. Starting off-screen is deliberate rather than using
// google.maps.Animation.DROP: the built-in animation paints its first frame
// at the real position before animating, which reads as a flash (see the
// prototype's own comment, and commit 4bc38a9 in the legacy monolith).
export function dropStartLat(targetLat: number, northEastLat: number | null): number {
  return northEastLat === null ? targetLat + START_ABOVE_FALLBACK : northEastLat + START_ABOVE_BOUNDS;
}

// Ease-out cubic — fast at first, settling gently onto the target.
export function dropEase(t: number): number {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

// Fisher-Yates. Without it the queue is every shop followed by every event,
// so the two kinds would fall in two visibly separate waves.
export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A rain of markers is exactly the kind of large motion "reduce motion" is
// meant to suppress, so honour it and place them directly instead. Guarded
// for environments without matchMedia rather than assumed present.
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Splits the staged queue into batches, each with the delay after which it
// starts falling: DROP_BATCH_SIZE markers begin together every
// DROP_STAGGER_MS, so the whole set rains in rather than landing at once.
export function dropBatches<T>(
  items: T[],
  batchSize: number = DROP_BATCH_SIZE,
  stagger: number = DROP_STAGGER_MS,
): { items: T[]; delayMs: number }[] {
  const size = Math.max(1, Math.round(batchSize));
  const batches: { items: T[]; delayMs: number }[] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push({ items: items.slice(i, i + size), delayMs: (i / size) * stagger });
  }
  return batches;
}

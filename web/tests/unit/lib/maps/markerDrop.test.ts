import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DROP_BATCH_SIZE,
  DROP_STAGGER_MS,
  dropBatches,
  dropEase,
  dropStartLat,
  prefersReducedMotion,
  shuffled,
} from "@/lib/maps/markerDrop";

describe("dropStartLat", () => {
  it("starts just above the viewport's north edge when the map has bounds", () => {
    expect(dropStartLat(51.5, 51.62)).toBeCloseTo(51.65, 10);
  });

  // The north edge, not the marker, decides the start: two markers far apart
  // must begin at the same height or they visibly fall different distances.
  it("uses the same start height for every marker regardless of its target", () => {
    expect(dropStartLat(51.4, 51.62)).toEqual(dropStartLat(51.59, 51.62));
  });

  it("falls back to an offset above the target when the map has no bounds yet", () => {
    expect(dropStartLat(51.5, null)).toBeCloseTo(51.62, 10);
  });
});

describe("dropEase", () => {
  it("runs from the start position to exactly the target", () => {
    expect(dropEase(0)).toBe(0);
    expect(dropEase(1)).toBe(1);
  });

  it("eases out — more than half the distance is covered by halfway", () => {
    expect(dropEase(0.5)).toBeGreaterThan(0.5);
  });

  it("is monotonic", () => {
    const samples = [0, 0.2, 0.4, 0.6, 0.8, 1].map(dropEase);
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThan(samples[i - 1]);
  });

  // rAF can hand back a timestamp past the end of the animation, which would
  // otherwise overshoot the target and snap back.
  it("clamps out-of-range progress", () => {
    expect(dropEase(1.4)).toBe(1);
    expect(dropEase(-0.3)).toBe(0);
  });
});

describe("shuffled", () => {
  it("keeps every item, without mutating the input", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffled(input, () => 0.5);
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it("actually reorders — shops and events must not fall in two separate waves", () => {
    // A deterministic "random" that always picks index 0 to swap with.
    expect(shuffled(["a", "b", "c"], () => 0)).not.toEqual(["a", "b", "c"]);
  });
});

describe("dropBatches", () => {
  it("releases DROP_BATCH_SIZE markers per turn, one stagger apart", () => {
    const batches = dropBatches([1, 2, 3, 4, 5]);
    expect(batches.map((b) => b.items)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batches.map((b) => b.delayMs)).toEqual([0, DROP_STAGGER_MS, DROP_STAGGER_MS * 2]);
    expect(DROP_BATCH_SIZE).toBe(2);
  });

  it("returns nothing for an empty queue", () => {
    expect(dropBatches([])).toEqual([]);
  });

  it("never divides by zero on a zero or fractional batch size", () => {
    expect(dropBatches([1, 2], 0).map((b) => b.items)).toEqual([[1], [2]]);
    expect(dropBatches([1, 2, 3], 1.6).map((b) => b.items)).toEqual([[1, 2], [3]]);
  });
});

describe("prefersReducedMotion", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  it("is true when the user asked for reduced motion", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(true);
  });

  it("is false otherwise", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    expect(prefersReducedMotion()).toBe(false);
  });

  it("is false where matchMedia doesn't exist rather than throwing", () => {
    // @ts-expect-error deliberately removing it to mimic a non-browser env
    window.matchMedia = undefined;
    expect(prefersReducedMotion()).toBe(false);
  });
});

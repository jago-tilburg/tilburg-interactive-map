import { describe, it, expect, beforeEach } from "vitest";
import { loadGoogleMaps, _resetGoogleMapsLoaderForTests } from "@/lib/maps/loadGoogleMaps";

beforeEach(() => {
  _resetGoogleMapsLoaderForTests();
  delete (window as { google?: unknown }).google;
  document.head.querySelectorAll("script").forEach((s) => s.remove());
});

describe("loadGoogleMaps", () => {
  it("resolves immediately when google.maps is already present", async () => {
    window.google = { maps: {} } as never;
    await expect(loadGoogleMaps("test-key")).resolves.toBeUndefined();
    expect(document.head.querySelectorAll("script")).toHaveLength(0);
  });

  it("injects exactly one script tag and resolves when it loads", async () => {
    const promise = loadGoogleMaps("test-key");
    const script = document.head.querySelector("script");
    expect(script).not.toBeNull();
    expect(script!.src).toContain("maps.googleapis.com/maps/api/js");
    expect(script!.src).toContain("key=test-key");

    script!.onload?.(new Event("load"));
    await expect(promise).resolves.toBeUndefined();
  });

  it("reuses the same in-flight promise across concurrent calls", () => {
    const first = loadGoogleMaps("test-key");
    const second = loadGoogleMaps("test-key");
    expect(second).toBe(first);
    expect(document.head.querySelectorAll("script")).toHaveLength(1);
  });

  it("rejects and clears the cache when the script fails to load", async () => {
    const promise = loadGoogleMaps("test-key");
    const script = document.head.querySelector("script")!;
    script.onerror?.(new Event("error"));

    await expect(promise).rejects.toThrow("Failed to load the Google Maps script");

    // A retry after failure injects a fresh script rather than reusing the dead promise.
    document.head.querySelectorAll("script").forEach((s) => s.remove());
    const retry = loadGoogleMaps("test-key");
    expect(document.head.querySelectorAll("script")).toHaveLength(1);
    document.head.querySelector("script")!.onload?.(new Event("load"));
    await expect(retry).resolves.toBeUndefined();
  });
});

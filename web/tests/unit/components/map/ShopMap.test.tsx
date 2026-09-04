import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import type { Shop } from "@/types/shops";
import type { BusinessEvent } from "@/types/events";

const loadGoogleMaps = vi.fn();
vi.mock("@/lib/maps/loadGoogleMaps", () => ({
  loadGoogleMaps: (...args: unknown[]) => loadGoogleMaps(...args),
}));

let createdMarkers: FakeMarker[] = [];
let createdMaps: FakeMap[] = [];

class FakeMarker {
  setMap = vi.fn();
  setPosition = vi.fn();
  setIcon = vi.fn();
  listeners = new Map<string, () => void>();
  constructor(public opts: Record<string, unknown>) {
    createdMarkers.push(this);
  }
  addListener(event: string, cb: () => void) {
    this.listeners.set(event, cb);
  }
}
class FakeMap {
  zoomListener: (() => void) | null = null;
  currentZoom = 13;
  listeners = new Map<string, (e?: unknown) => void>();
  constructor(
    public el: HTMLElement,
    public opts: Record<string, unknown>,
  ) {
    createdMaps.push(this);
  }
  addListener(event: string, cb: (e?: unknown) => void) {
    if (event === "zoom_changed") this.zoomListener = cb;
    this.listeners.set(event, cb);
    return { __event: event };
  }
  getZoom() {
    return this.currentZoom;
  }
  // The drop animation starts markers above the viewport's north edge, so it
  // asks the map where that edge is. Returns undefined when `bounds` is
  // cleared, mirroring the real API before the map's first layout settles.
  bounds: { north: number } | undefined = { north: 51.62 };
  getBounds() {
    return this.bounds && { getNorthEast: () => ({ lat: () => this.bounds!.north }) };
  }
}
class FakeSize {
  constructor(
    public width: number,
    public height: number,
  ) {}
}
class FakePoint {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

import { ShopMap } from "@/components/map/ShopMap";

function makeShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 9001,
    name: "Test Shop",
    address: "Heuvelplein 1",
    lat: 51.5,
    lng: 5.09,
    rating: 8,
    price: "€€",
    photoUrl: "",
    review: "Nice",
    tiktokUrl: "",
    instagramUrl: "",
    dietaryOptions: { glutenvrij: false, halal: false, vega: false },
    createdAt: "2026-01-01",
    likes: [],
    comments: [],
    userReviews: [],
    userRatings: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<BusinessEvent> = {}): BusinessEvent {
  return {
    id: "evt1",
    title: "Test Event",
    category: "eten",
    description: "desc",
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    startTime: "10:00",
    endTime: "18:00",
    address: "Heuvelplein 1",
    lat: 51.5,
    lng: 5.09,
    ownerId: "owner-uid",
    city: "Tilburg",
    status: "approved",
    paid: true,
    createdAt: null as never,
    ...overrides,
  };
}

// Default every test to "reduce motion", so markers are placed directly and
// assertions can talk about their settled positions. The drop animation gets
// its own describe block below, which opts back into motion explicitly.
function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: reduce,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  setReducedMotion(true);
  vi.clearAllMocks();
  createdMarkers = [];
  createdMaps = [];
  loadGoogleMaps.mockResolvedValue(undefined);
  window.google = {
    maps: {
      Map: FakeMap,
      Marker: FakeMarker,
      Size: FakeSize,
      Point: FakePoint,
      event: { removeListener: vi.fn() },
    },
  } as never;
});

describe("ShopMap", () => {
  it("loads the Maps script with the given API key and creates a map instance", async () => {
    render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(loadGoogleMaps).toHaveBeenCalledWith("test-key"));
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("shows an error message when the map fails to load", async () => {
    loadGoogleMaps.mockRejectedValue(new Error("network down"));
    render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("network down");
  });

  it("shows a generic error message when the map load rejects with a non-Error", async () => {
    loadGoogleMaps.mockRejectedValue("not an Error instance");
    render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Kaart laden mislukt.");
  });

  it("does not create the map instance if the component unmounts before the script finishes loading", async () => {
    let resolveLoad: () => void = () => {};
    loadGoogleMaps.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const { unmount } = render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );
    unmount();
    resolveLoad();
    await Promise.resolve();

    expect(createdMarkers).toHaveLength(0);
  });

  it("does not set an error message if the component unmounts before the script load rejects", async () => {
    let rejectLoad: (err: Error) => void = () => {};
    loadGoogleMaps.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectLoad = reject;
        }),
    );

    const { unmount } = render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );
    unmount();
    rejectLoad(new Error("network down"));
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("creates a marker per shop, positioned and titled correctly, and calls onShopClick when clicked", async () => {
    const onShopClick = vi.fn();
    const shop = makeShop();
    render(
      <ShopMap apiKey="test-key" shops={[shop]} businessEvents={[]} onShopClick={onShopClick} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(createdMarkers).toHaveLength(1));
    const marker = createdMarkers[0];
    expect(marker.opts.position).toEqual({ lat: 51.5, lng: 5.09 });
    expect(marker.opts.title).toBe("Test Shop");

    marker.listeners.get("click")?.();
    expect(onShopClick).toHaveBeenCalledWith(9001);
  });

  it("creates a marker per business event and calls onBusinessEventClick when clicked", async () => {
    const onBusinessEventClick = vi.fn();
    const event = makeEvent();
    render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={onBusinessEventClick} />,
    );

    await waitFor(() => expect(createdMarkers).toHaveLength(1));
    const marker = createdMarkers[0];
    expect(marker.opts.title).toBe("Test Event");

    marker.listeners.get("click")?.();
    expect(onBusinessEventClick).toHaveBeenCalledWith("evt1");
  });

  it("removes a shop's marker from the map when it disappears from props", async () => {
    const shop = makeShop();
    const { rerender } = render(
      <ShopMap apiKey="test-key" shops={[shop]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );
    await waitFor(() => expect(createdMarkers).toHaveLength(1));
    const marker = createdMarkers[0];

    rerender(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(marker.setMap).toHaveBeenCalledWith(null));
  });

  it("removes a business event's marker from the map when it disappears from props", async () => {
    const event = makeEvent();
    const { rerender } = render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );
    await waitFor(() => expect(createdMarkers).toHaveLength(1));
    const marker = createdMarkers[0];

    rerender(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(marker.setMap).toHaveBeenCalledWith(null));
  });

  it("does not recreate a business event's marker on re-render when it is still present", async () => {
    const event = makeEvent();
    const { rerender } = render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );
    await waitFor(() => expect(createdMarkers).toHaveLength(1));

    rerender(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    expect(createdMarkers).toHaveLength(1);
  });

  it("repositions an existing shop's marker instead of recreating it when its coordinates change", async () => {
    const shop = makeShop();
    const { rerender } = render(
      <ShopMap apiKey="test-key" shops={[shop]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );
    await waitFor(() => expect(createdMarkers).toHaveLength(1));

    const moved = { ...shop, lat: 52, lng: 6 };
    rerender(
      <ShopMap apiKey="test-key" shops={[moved]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(createdMarkers[0].setPosition).toHaveBeenCalledWith({ lat: 52, lng: 6 }));
    expect(createdMarkers).toHaveLength(1);
  });

  it("uses the parent umbrella's color for a linked event's marker border", async () => {
    const event = makeEvent({ umbrellaEventId: "u1" });
    render(
      <ShopMap
        apiKey="test-key"
        shops={[]}
        businessEvents={[event]}
        umbrellaEvents={[
          { id: "u1", title: "Kermis", description: "", color: "#123456", startDate: "2026-01-01", endDate: "2099-01-01", city: "Tilburg", createdAt: null as never },
        ]}
        onShopClick={vi.fn()}
        onBusinessEventClick={vi.fn()}
      />,
    );

    await waitFor(() => expect(createdMarkers).toHaveLength(1));
    const icon = createdMarkers[0].opts.icon as { url: string };
    expect(decodeURIComponent(icon.url)).toContain("#123456");
  });

  it("falls back to the default border color when an event has no linked umbrella", async () => {
    const event = makeEvent();
    render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(createdMarkers).toHaveLength(1));
    const icon = createdMarkers[0].opts.icon as { url: string };
    expect(decodeURIComponent(icon.url)).toContain("#22c55e");
  });

  it("marks a currently-in-progress event's icon as happening now", async () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const event = makeEvent({
      startDate: today,
      endDate: today,
      startTime: "00:00",
      endTime: "23:59",
    });
    render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(createdMarkers).toHaveLength(1));
    const icon = createdMarkers[0].opts.icon as { url: string };
    expect(decodeURIComponent(icon.url)).toContain("feGaussianBlur");
  });

  it("does not mark an event outside its date range as happening now", async () => {
    const event = makeEvent({ startDate: "2020-01-01", endDate: "2020-01-01" });
    render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(createdMarkers).toHaveLength(1));
    const icon = createdMarkers[0].opts.icon as { url: string };
    expect(decodeURIComponent(icon.url)).not.toContain("feGaussianBlur");
  });

  it("rebuilds event marker icons every 60s to reflect happening-now transitions", async () => {
    vi.useFakeTimers();
    try {
      const event = makeEvent();
      render(
        <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
      );
      // ready -> collection window -> staging is a few commits deep, so
      // clear the whole window rather than a single tick (see markerDrop.ts).
      // Two passes on purpose: getting to a created marker is map-ready ->
      // collection window -> stage -> hand back, and each pass flushes one
      // round of pending timers plus the render they trigger.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(createdMarkers).toHaveLength(1);

      const callsBefore = createdMarkers[0].setIcon.mock.calls.length;
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(createdMarkers[0].setIcon.mock.calls.length).toBeGreaterThan(callsBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the emoji fallback immediately, then upgrades the icon once the photo fetch resolves", async () => {
    const blob = new Blob(["fake-image-bytes"], { type: "image/png" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    vi.stubGlobal("fetch", fetchMock);

    const event = makeEvent({ category: "muziek", photoUrl: "https://example.com/shopmap-photo.jpg" });
    render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(createdMarkers).toHaveLength(1));
    const marker = createdMarkers[0];
    expect(decodeURIComponent((marker.opts.icon as { url: string }).url)).toContain("🎵");

    await waitFor(() => {
      const latest = marker.setIcon.mock.calls.at(-1)?.[0] as { url: string } | undefined;
      expect(latest && decodeURIComponent(latest.url)).toContain("<image");
    });
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/shopmap-photo.jpg", { mode: "cors" });

    vi.unstubAllGlobals();
  });

  it("keeps the emoji fallback icon when the photo fetch fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);

    const event = makeEvent({ category: "sport", photoUrl: "https://example.com/shopmap-photo-404.jpg" });
    render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // give the failed fetch's microtask queue a turn, then confirm no setIcon
    // upgrade happened — the marker's only icon is still the emoji fallback.
    await Promise.resolve();
    await Promise.resolve();
    const marker = createdMarkers[0];
    const appliedIcons = [
      (marker.opts.icon as { url: string }).url,
      ...marker.setIcon.mock.calls.map((c) => (c[0] as { url: string }).url),
    ].map(decodeURIComponent);
    // Every icon it ever wore is the emoji fallback; none embeds a photo.
    expect(appliedIcons.every((url) => url.includes("⚽"))).toBe(true);
    expect(appliedIcons.some((url) => url.includes("<image"))).toBe(false);

    vi.unstubAllGlobals();
  });

  it("does not re-fetch an already-resolved event photo on a later re-render", async () => {
    const blob = new Blob(["fake-image-bytes"], { type: "image/png" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });
    vi.stubGlobal("fetch", fetchMock);

    const event = makeEvent({ photoUrl: "https://example.com/shopmap-photo-cached.jpg" });
    const { rerender } = render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      const latest = createdMarkers[0].setIcon.mock.calls.at(-1)?.[0] as { url: string } | undefined;
      expect(latest && decodeURIComponent(latest.url)).toContain("<image");
    });

    rerender(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[{ ...event, title: "Updated" }]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(createdMarkers[0].setPosition).toHaveBeenCalled());
    // The re-render's own synchronous icon build already has the resolved
    // photo (from the component-level cache) — no flicker back to the emoji
    // fallback while a redundant fetch resolves.
    const latestAfterRerender = createdMarkers[0].setIcon.mock.calls.at(-1)?.[0] as { url: string };
    expect(decodeURIComponent(latestAfterRerender.url)).toContain("<image");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it("shows a category-emoji placeholder when the event has no photoUrl", async () => {
    const event = makeEvent({ category: "muziek" });
    render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(createdMarkers).toHaveLength(1));
    const icon = createdMarkers[0].opts.icon as { url: string };
    expect(decodeURIComponent(icon.url)).toContain("🎵");
  });

  it("rebuilds event marker icons at a larger size when the map zooms in", async () => {
    const event = makeEvent();
    render(
      <ShopMap apiKey="test-key" shops={[]} businessEvents={[event]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(createdMarkers).toHaveLength(1));
    const initialIcon = createdMarkers[0].opts.icon as { scaledSize: FakeSize };

    createdMaps[0].currentZoom = 18;
    createdMaps[0].zoomListener?.();

    await waitFor(() => {
      const latestIcon = createdMarkers[0].setIcon.mock.calls.at(-1)?.[0] as { scaledSize: FakeSize };
      expect(latestIcon.scaledSize.width).toBeGreaterThan(initialIcon.scaledSize.width);
    });
  });

  describe("admin long-press-to-add", () => {
    it("triggers onLongPressAdd after holding the map for the long-press duration", async () => {
      vi.useFakeTimers();
      const onLongPressAdd = vi.fn();
      render(
        <ShopMap
          apiKey="test-key"
          shops={[]}
          businessEvents={[]}
          onShopClick={vi.fn()}
          onBusinessEventClick={vi.fn()}
          isAdmin
          onLongPressAdd={onLongPressAdd}
        />,
      );
      await vi.waitFor(() => expect(createdMaps).toHaveLength(1));

      const fakeLatLng = { lat: () => 51.5, lng: () => 5.09 };
      createdMaps[0].listeners.get("mousedown")?.({ latLng: fakeLatLng });
      vi.advanceTimersByTime(800);

      expect(onLongPressAdd).toHaveBeenCalledWith(51.5, 5.09);
      vi.useRealTimers();
    });

    it("does not trigger before the long-press duration elapses", async () => {
      vi.useFakeTimers();
      const onLongPressAdd = vi.fn();
      render(
        <ShopMap
          apiKey="test-key"
          shops={[]}
          businessEvents={[]}
          onShopClick={vi.fn()}
          onBusinessEventClick={vi.fn()}
          isAdmin
          onLongPressAdd={onLongPressAdd}
        />,
      );
      await vi.waitFor(() => expect(createdMaps).toHaveLength(1));

      createdMaps[0].listeners.get("mousedown")?.({ latLng: { lat: () => 51.5, lng: () => 5.09 } });
      vi.advanceTimersByTime(500);

      expect(onLongPressAdd).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("cancels the long-press on mouseup", async () => {
      vi.useFakeTimers();
      const onLongPressAdd = vi.fn();
      render(
        <ShopMap
          apiKey="test-key"
          shops={[]}
          businessEvents={[]}
          onShopClick={vi.fn()}
          onBusinessEventClick={vi.fn()}
          isAdmin
          onLongPressAdd={onLongPressAdd}
        />,
      );
      await vi.waitFor(() => expect(createdMaps).toHaveLength(1));

      createdMaps[0].listeners.get("mousedown")?.({ latLng: { lat: () => 51.5, lng: () => 5.09 } });
      createdMaps[0].listeners.get("mouseup")?.();
      vi.advanceTimersByTime(800);

      expect(onLongPressAdd).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("cancels the long-press on dragstart", async () => {
      vi.useFakeTimers();
      const onLongPressAdd = vi.fn();
      render(
        <ShopMap
          apiKey="test-key"
          shops={[]}
          businessEvents={[]}
          onShopClick={vi.fn()}
          onBusinessEventClick={vi.fn()}
          isAdmin
          onLongPressAdd={onLongPressAdd}
        />,
      );
      await vi.waitFor(() => expect(createdMaps).toHaveLength(1));

      createdMaps[0].listeners.get("mousedown")?.({ latLng: { lat: () => 51.5, lng: () => 5.09 } });
      createdMaps[0].listeners.get("dragstart")?.();
      vi.advanceTimersByTime(800);

      expect(onLongPressAdd).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("ignores a mousedown with no latLng", async () => {
      vi.useFakeTimers();
      const onLongPressAdd = vi.fn();
      render(
        <ShopMap
          apiKey="test-key"
          shops={[]}
          businessEvents={[]}
          onShopClick={vi.fn()}
          onBusinessEventClick={vi.fn()}
          isAdmin
          onLongPressAdd={onLongPressAdd}
        />,
      );
      await vi.waitFor(() => expect(createdMaps).toHaveLength(1));

      createdMaps[0].listeners.get("mousedown")?.({});
      vi.advanceTimersByTime(800);

      expect(onLongPressAdd).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("does not attach long-press listeners for a non-admin", async () => {
      render(
        <ShopMap apiKey="test-key" shops={[]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
      );
      await waitFor(() => expect(createdMaps).toHaveLength(1));

      expect(createdMaps[0].listeners.has("mousedown")).toBe(false);
    });

    it("removes the long-press listeners on unmount", async () => {
      const onLongPressAdd = vi.fn();
      const { unmount } = render(
        <ShopMap
          apiKey="test-key"
          shops={[]}
          businessEvents={[]}
          onShopClick={vi.fn()}
          onBusinessEventClick={vi.fn()}
          isAdmin
          onLongPressAdd={onLongPressAdd}
        />,
      );
      await waitFor(() => expect(createdMaps).toHaveLength(1));

      unmount();
      expect(window.google.maps.event.removeListener).toHaveBeenCalledTimes(3);
    });
  });
});

describe("ShopMap marker drop animation", () => {
  // Drives rAF manually so a fall can be inspected frame by frame instead of
  // waiting on the real clock.
  function withManualRaf() {
    const frames: FrameRequestCallback[] = [];
    let clock = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    return {
      // Runs whatever frames are queued, at the given elapsed time.
      tick(ms: number) {
        clock = ms;
        const queued = frames.splice(0, frames.length);
        queued.forEach((cb) => cb(clock));
      },
      pending: () => frames.length,
    };
  }

  async function settleStaging() {
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
    }
  }

  it("starts markers above the viewport and eases them down to their real position", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const raf = withManualRaf();
    try {
      render(
        <ShopMap apiKey="test-key" shops={[makeShop()]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
      );
      await settleStaging();

      expect(createdMarkers).toHaveLength(1);
      const marker = createdMarkers[0];
      // FakeMap reports a north edge of 51.62; the shop's real lat is 51.5.
      expect((marker.opts.position as { lat: number }).lat).toBeCloseTo(51.65, 10);

      raf.tick(0);
      const first = marker.setPosition.mock.calls[0][0] as { lat: number };
      expect(first.lat).toBeCloseTo(51.65, 10);

      // Halfway through the 500ms fall it must be past halfway down (ease-out).
      raf.tick(250);
      const mid = marker.setPosition.mock.calls.at(-1)![0] as { lat: number };
      expect(mid.lat).toBeLessThan((51.65 + 51.5) / 2);
      expect(mid.lat).toBeGreaterThan(51.5);

      raf.tick(500);
      const landed = marker.setPosition.mock.calls.at(-1)![0] as { lat: number; lng: number };
      expect(landed).toEqual({ lat: 51.5, lng: 5.09 });
      // Landed means done — no further frames requested.
      expect(raf.pending()).toBe(0);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("hides the rating while a shop falls and reveals it on landing", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const raf = withManualRaf();
    try {
      render(
        <ShopMap apiKey="test-key" shops={[makeShop({ rating: 8 })]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
      );
      await settleStaging();
      const marker = createdMarkers[0];

      expect(decodeURIComponent((marker.opts.icon as { url: string }).url)).not.toContain("8.0");

      raf.tick(0);
      raf.tick(500);
      const revealed = marker.setIcon.mock.calls.at(-1)![0] as { url: string };
      expect(decodeURIComponent(revealed.url)).toContain("8.0");
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("staggers shops and events into one shared queue rather than two waves", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    withManualRaf();
    try {
      const shops = [1, 2, 3].map((n) => makeShop({ id: 9000 + n, lat: 51.5 + n / 100 }));
      const events = ["a", "b", "c"].map((k) => makeEvent({ id: `evt-${k}` }));
      render(
        <ShopMap apiKey="test-key" shops={shops} businessEvents={events} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
      );
      // Step in increments smaller than one 40ms stagger, so the first
      // marker to appear catches the queue mid-flight.
      let guard = 0;
      while (createdMarkers.length === 0 && guard++ < 20) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(20);
        });
      }
      expect(createdMarkers.length).toBeGreaterThan(0);
      // 6 markers at 2 per turn: they must not all be created at once.
      expect(createdMarkers.length).toBeLessThan(6);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(createdMarkers).toHaveLength(6);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  // The whole point of "first visit only": a marker coming back after a filter
  // toggle should reappear in place, not sail in from above again.
  it("does not re-animate a marker that reappears after being filtered out", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    const raf = withManualRaf();
    try {
      const shop = makeShop();
      const { rerender } = render(
        <ShopMap apiKey="test-key" shops={[shop]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
      );
      await settleStaging();
      raf.tick(0);
      raf.tick(500);
      const droppedCount = createdMarkers.length;

      // Filter it away, then bring it back.
      rerender(
        <ShopMap apiKey="test-key" shops={[]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
      );
      rerender(
        <ShopMap apiKey="test-key" shops={[shop]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(createdMarkers).toHaveLength(droppedCount + 1);
      const revived = createdMarkers.at(-1)!;
      expect(revived.opts.position).toEqual({ lat: 51.5, lng: 5.09 });
      expect(decodeURIComponent((revived.opts.icon as { url: string }).url)).toContain("8.0");
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("places markers directly when the user prefers reduced motion", async () => {
    setReducedMotion(true);
    render(
      <ShopMap apiKey="test-key" shops={[makeShop()]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
    );

    await waitFor(() => expect(createdMarkers).toHaveLength(1));
    // Born at its final position, and never moved anywhere else — the sync
    // effect re-asserting that same position afterwards is not a fall.
    expect(createdMarkers[0].opts.position).toEqual({ lat: 51.5, lng: 5.09 });
    const positions = createdMarkers[0].setPosition.mock.calls.map((c) => c[0] as { lat: number });
    expect(positions.every((pos) => pos.lat === 51.5)).toBe(true);
  });

  it("falls from above the target when the map has no bounds yet", async () => {
    setReducedMotion(false);
    vi.useFakeTimers();
    withManualRaf();
    try {
      render(
        <ShopMap apiKey="test-key" shops={[makeShop()]} businessEvents={[]} onShopClick={vi.fn()} onBusinessEventClick={vi.fn()} />,
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      createdMaps[0].bounds = undefined;
      await settleStaging();

      expect((createdMarkers[0].opts.position as { lat: number }).lat).toBeCloseTo(51.62, 10);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

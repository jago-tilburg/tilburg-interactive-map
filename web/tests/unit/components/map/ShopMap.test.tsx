import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Shop } from "@/types/shops";
import type { BusinessEvent } from "@/types/events";

const loadGoogleMaps = vi.fn();
vi.mock("@/lib/maps/loadGoogleMaps", () => ({
  loadGoogleMaps: (...args: unknown[]) => loadGoogleMaps(...args),
}));

let createdMarkers: FakeMarker[] = [];

class FakeMarker {
  setMap = vi.fn();
  setPosition = vi.fn();
  listeners = new Map<string, () => void>();
  constructor(public opts: Record<string, unknown>) {
    createdMarkers.push(this);
  }
  addListener(event: string, cb: () => void) {
    this.listeners.set(event, cb);
  }
}
class FakeMap {
  constructor(
    public el: HTMLElement,
    public opts: Record<string, unknown>,
  ) {}
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
    status: "approved",
    paid: true,
    createdAt: null as never,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createdMarkers = [];
  loadGoogleMaps.mockResolvedValue(undefined);
  window.google = {
    maps: {
      Map: FakeMap,
      Marker: FakeMarker,
      Size: FakeSize,
      Point: FakePoint,
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
});

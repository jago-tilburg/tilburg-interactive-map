import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const showToast = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast }),
}));

// routerReplace updates the mocked pathname too, mirroring how a real
// router.replace() changes what usePathname() subsequently returns — needed
// so the "don't replace when already on the matching path" behavior can
// actually be exercised across a sequence of navigations within one test.
const mockUsePathname = vi.fn(() => "/");
const routerReplace = vi.fn((path: string) => {
  mockUsePathname.mockReturnValue(path);
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
  usePathname: () => mockUsePathname(),
}));

vi.mock("@/components/map/ShopMap", () => ({
  ShopMap: ({
    shops,
    businessEvents,
    onShopClick,
    onBusinessEventClick,
    onLongPressAdd,
  }: {
    shops: Shop[];
    businessEvents: BusinessEvent[];
    onShopClick: (id: number) => void;
    onBusinessEventClick: (id: string) => void;
    onLongPressAdd?: (lat: number, lng: number) => void;
  }) => (
    <div>
      <span data-testid="visible-shop-count">{shops.length}</span>
      <span data-testid="visible-event-count">{businessEvents.length}</span>
      <button onClick={() => onShopClick(9001)}>click-shop</button>
      <button onClick={() => onBusinessEventClick("evt1")}>click-event</button>
      <button onClick={() => onLongPressAdd?.(51.6, 5.1)}>trigger-long-press</button>
    </div>
  ),
}));

const reverseGeocode = vi.fn();
vi.mock("@/lib/maps/reverseGeocode", () => ({
  reverseGeocode: (...a: unknown[]) => reverseGeocode(...a),
}));

const shop: Shop = {
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
};

const businessEvent: BusinessEvent = {
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
  umbrellaEventId: "u1",
};

const umbrella: UmbrellaEvent = {
  id: "u1",
  title: "Kermis",
  description: "",
  color: "#b45309",
  startDate: "2026-01-01",
  endDate: "2099-01-01",
  city: "Tilburg",
  createdAt: null as never,
};

const subscribeShops = vi.fn((onChange: (s: Shop[]) => void, _onError?: (e: Error) => void) => {
  onChange([shop]);
  return vi.fn();
});
vi.mock("@/lib/firebase/shops", () => ({
  subscribeShops: (...a: [(s: Shop[]) => void, ((e: Error) => void)?]) => subscribeShops(...a),
  trackShopView: vi.fn().mockResolvedValue(1),
  getShopViews: vi.fn().mockResolvedValue(0),
  setShopLike: vi.fn(),
  setShopUserRating: vi.fn(),
  addShopComment: vi.fn(),
  removeShopComment: vi.fn(),
  addShopUserReview: vi.fn(),
  removeShopUserReview: vi.fn(),
  deleteShop: vi.fn(),
  createShop: vi.fn(),
  updateShop: vi.fn(),
}));

const subscribeApprovedBusinessEvents = vi.fn(
  (onChange: (e: BusinessEvent[]) => void, _onError?: (e: Error) => void) => {
    onChange([businessEvent]);
    return vi.fn();
  },
);
vi.mock("@/lib/firebase/businessEvents", () => ({
  subscribeApprovedBusinessEvents: (...a: [(e: BusinessEvent[]) => void, ((e: Error) => void)?]) =>
    subscribeApprovedBusinessEvents(...a),
  trackEventView: vi.fn().mockResolvedValue(undefined),
  incrementEventInterest: vi.fn().mockResolvedValue(undefined),
  incrementEventClicks: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase/firestore", () => ({
  setEventSaved: vi.fn().mockResolvedValue(undefined),
}));

const subscribeUmbrellaEvents = vi.fn((onChange: (u: UmbrellaEvent[]) => void, _onError?: (e: Error) => void) => {
  onChange([umbrella]);
  return vi.fn();
});
vi.mock("@/lib/firebase/umbrellaEvents", () => ({
  subscribeUmbrellaEvents: (...a: [(u: UmbrellaEvent[]) => void, ((e: Error) => void)?]) =>
    subscribeUmbrellaEvents(...a),
}));

vi.mock("@/lib/shops/anonUserId", () => ({
  getAnonUserId: vi.fn(() => "anon-1"),
}));

vi.mock("@/lib/shops/navigateToLocation", () => ({
  navigateToLocation: vi.fn(),
}));

const submitRequest = vi.fn();
vi.mock("@/lib/firebase/requests", () => ({
  submitRequest: (...a: unknown[]) => submitRequest(...a),
}));

const trackEvent = vi.fn();
vi.mock("@/lib/analytics/trackEvent", () => ({
  trackEvent: (...a: unknown[]) => trackEvent(...a),
}));

import { MapExperience } from "@/components/map/MapExperience";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: false });
  mockUsePathname.mockReturnValue("/");
  subscribeShops.mockImplementation((onChange: (s: Shop[]) => void) => {
    onChange([shop]);
    return vi.fn();
  });
  subscribeApprovedBusinessEvents.mockImplementation((onChange: (e: BusinessEvent[]) => void) => {
    onChange([businessEvent]);
    return vi.fn();
  });
  subscribeUmbrellaEvents.mockImplementation((onChange: (u: UmbrellaEvent[]) => void) => {
    onChange([umbrella]);
    return vi.fn();
  });
  submitRequest.mockResolvedValue(undefined);
  reverseGeocode.mockResolvedValue("Heuvelplein 1, Tilburg");
});

describe("MapExperience data-loading failures", () => {
  it("toasts and logs when the shops subscription is rejected", () => {
    const err = new Error("permission_denied");
    subscribeShops.mockImplementation((_onChange, onError) => {
      onError?.(err);
      return vi.fn();
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<MapExperience apiKey="k" />);

    expect(showToast).toHaveBeenCalledWith(
      "Broodjes konden niet worden geladen. Ververs de pagina.",
      "error",
    );
    expect(spy).toHaveBeenCalledWith("[2happies] shops subscription failed:", err);
    spy.mockRestore();
  });

  // Three simultaneous failures (an offline device) must not stack three
  // notifications over the map — the console still records all of them.
  it("shows at most one toast when every subscription fails at once", () => {
    const reject = (_onChange: unknown, onError?: (e: Error) => void) => {
      onError?.(new Error("offline"));
      return vi.fn();
    };
    subscribeShops.mockImplementation(reject);
    subscribeApprovedBusinessEvents.mockImplementation(reject);
    subscribeUmbrellaEvents.mockImplementation(reject);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<MapExperience apiKey="k" />);

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  // The real regression this guards: a transport that never connects is not
  // an error to the SDK, so onError never fires and the old code sat there
  // silently forever. Silence itself has to raise the alarm.
  it("warns when a subscription never delivers and never errors either", () => {
    vi.useFakeTimers();
    subscribeShops.mockImplementation(() => vi.fn());
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<MapExperience apiKey="k" />);
    expect(showToast).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(showToast).toHaveBeenCalledWith(
      "Kon broodjes niet laden. Controleer je verbinding.",
      "error",
    );
    spy.mockRestore();
    vi.useRealTimers();
  });

  it("names every source when nothing at all arrives", () => {
    vi.useFakeTimers();
    const silent = () => vi.fn();
    subscribeShops.mockImplementation(silent);
    subscribeApprovedBusinessEvents.mockImplementation(silent);
    subscribeUmbrellaEvents.mockImplementation(silent);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<MapExperience apiKey="k" />);
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(showToast).toHaveBeenCalledWith(
      "Kon broodjes en events en grote events niet laden. Controleer je verbinding.",
      "error",
    );
    spy.mockRestore();
    vi.useRealTimers();
  });

  it("stays quiet when everything loads", () => {
    vi.useFakeTimers();
    render(<MapExperience apiKey="k" />);

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(showToast).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("MapExperience", () => {
  it("shows the header title and passes shops/events through to the map", () => {
    render(<MapExperience apiKey="test-key" />);
    expect(screen.getByText("2 HAPPIES BIJ")).toBeInTheDocument();
    expect(screen.getByTestId("visible-shop-count")).toHaveTextContent("1");
    expect(screen.getByTestId("visible-event-count")).toHaveTextContent("1");
  });

  it("opens the shop detail modal when a shop marker is clicked", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("click-shop"));
    expect(screen.getByRole("dialog", { name: "Test Shop" })).toBeInTheDocument();
  });

  it("opens the business event detail modal when an event marker is clicked", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("click-event"));
    expect(screen.getByRole("dialog", { name: "🍔 Test Event" })).toBeInTheDocument();
  });

  it("closes the shop detail modal", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("click-shop"));
    await user.click(within(screen.getByRole("dialog")).getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the business event detail modal", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("click-event"));
    await user.click(within(screen.getByRole("dialog")).getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the umbrella detail modal", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("click-event"));
    await user.click(within(screen.getByRole("dialog")).getByText(/Onderdeel van Kermis/));
    await user.click(within(screen.getByRole("dialog")).getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("navigates from an event's umbrella badge to the umbrella detail, and back to the event", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("click-event"));
    await user.click(within(screen.getByRole("dialog")).getByText(/Onderdeel van Kermis/));
    expect(screen.getByRole("dialog", { name: "🎪 Kermis" })).toBeInTheDocument();

    await user.click(within(screen.getByRole("dialog")).getByText(/Test Event/));
    expect(screen.getByRole("dialog", { name: "🍔 Test Event" })).toBeInTheDocument();
  });

  it("opens a pre-filled create-shop form after an admin long-presses the map", async () => {
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("trigger-long-press"));
    expect(reverseGeocode).toHaveBeenCalledWith(51.6, 5.1);

    expect(await screen.findByDisplayValue("Heuvelplein 1, Tilburg")).toBeInTheDocument();
    expect(screen.getByLabelText("Breedtegraad")).toHaveValue(51.6);
    expect(screen.getByLabelText("Lengtegraad")).toHaveValue(5.1);
  });

  it("clears the long-press prefill after cancelling, then editing a shop opens a clean edit form", async () => {
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("trigger-long-press"));
    expect(await screen.findByDisplayValue("Heuvelplein 1, Tilburg")).toBeInTheDocument();
    await user.click(screen.getByText("Annuleren"));

    await user.click(screen.getByText("click-shop"));
    await user.click(screen.getByText("✏️ Bewerken"));
    expect(screen.getByRole("dialog", { name: "Bewerken Review" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test Shop")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Heuvelplein 1, Tilburg")).not.toBeInTheDocument();
  });

  it("always shows the request-a-review button in the header, regardless of admin status", () => {
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    render(<MapExperience apiKey="test-key" />);
    expect(screen.getByText(/Vraag een review aan/)).toBeInTheDocument();
  });

  it("narrows the map markers to match the filter panel's active filters", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    expect(screen.getByTestId("visible-event-count")).toHaveTextContent("1");
    await user.click(screen.getByText(/🥪 Broodjes/));
    expect(screen.getByTestId("visible-shop-count")).toHaveTextContent("1");
    expect(screen.getByTestId("visible-event-count")).toHaveTextContent("0");
  });

  it("opens and closes the mobile filter sheet", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("🔍 Filters"));
    await user.click(screen.getByLabelText("Filters sluiten"));
    expect(screen.getByText("🔍 Filters")).toBeInTheDocument();
  });

  it("selects a shop from the header's full list menu", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByLabelText("Alle 2 Happies"));
    await user.click(screen.getByText("Test Shop"));

    expect(screen.getByRole("dialog", { name: "Test Shop" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "ALLE 2 HAPPIES" })).not.toBeInTheDocument();
  });
});

describe("MapExperience — deep-link URL sync", () => {
  it("opens the shop detail modal immediately when initialSelection specifies a shop", () => {
    render(<MapExperience apiKey="test-key" initialSelection={{ type: "shop", id: 9001 }} />);
    expect(screen.getByRole("dialog", { name: "Test Shop" })).toBeInTheDocument();
  });

  it("opens the business event detail modal immediately when initialSelection specifies an event", () => {
    render(<MapExperience apiKey="test-key" initialSelection={{ type: "event", id: "evt1" }} />);
    expect(screen.getByRole("dialog", { name: "🍔 Test Event" })).toBeInTheDocument();
  });

  it("opens the umbrella detail modal immediately when initialSelection specifies an umbrella", () => {
    render(<MapExperience apiKey="test-key" initialSelection={{ type: "umbrella", id: "u1" }} />);
    expect(screen.getByRole("dialog", { name: "🎪 Kermis" })).toBeInTheDocument();
  });

  it("calls router.replace with the shop's path when a shop marker is clicked", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("click-shop"));

    expect(routerReplace).toHaveBeenCalledWith("/shop/9001", { scroll: false });
  });

  it("calls router.replace with the event's path when an event marker is clicked", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("click-event"));

    expect(routerReplace).toHaveBeenCalledWith("/event/evt1", { scroll: false });
  });

  it("calls router.replace with / when the detail modal is closed", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("click-shop"));
    routerReplace.mockClear();
    await user.click(within(screen.getByRole("dialog")).getByLabelText("Sluiten"));

    expect(routerReplace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("does not call router.replace when the URL already matches the current selection", () => {
    mockUsePathname.mockReturnValue("/shop/9001");
    render(<MapExperience apiKey="test-key" initialSelection={{ type: "shop", id: 9001 }} />);

    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("clears the selection when a deep-linked shop id doesn't match any real shop, once shops have loaded", async () => {
    render(<MapExperience apiKey="test-key" initialSelection={{ type: "shop", id: 424242 }} />);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("clears the selection when a deep-linked event id doesn't match any real event, once events have loaded", async () => {
    render(<MapExperience apiKey="test-key" initialSelection={{ type: "event", id: "does-not-exist" }} />);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("clears the selection when a deep-linked umbrella id doesn't match any real umbrella, once umbrellas have loaded", async () => {
    render(<MapExperience apiKey="test-key" initialSelection={{ type: "umbrella", id: "does-not-exist" }} />);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

// The money funnel's far end (see BusinessEventForm.test.tsx for the near
// end: event_form_opened/submit_attempt/checkout_redirect) — a return trip
// from Stripe Checkout via the ?payment=success|cancelled query param.
describe("MapExperience — Stripe Checkout return tracking", () => {
  it("shows a success toast and tracks event_checkout_return_success on a successful payment return", () => {
    render(<MapExperience apiKey="test-key" paymentStatus="success" />);

    expect(showToast).toHaveBeenCalledWith("Betaling gelukt — je evenement is nu live op de kaart.", "success");
    expect(trackEvent).toHaveBeenCalledWith("event_checkout_return_success");
    expect(trackEvent).not.toHaveBeenCalledWith("event_checkout_return_cancelled");
  });

  it("shows an info toast and tracks event_checkout_return_cancelled on a cancelled payment return", () => {
    render(<MapExperience apiKey="test-key" paymentStatus="cancelled" />);

    expect(showToast).toHaveBeenCalledWith("Betaling geannuleerd.", "info");
    expect(trackEvent).toHaveBeenCalledWith("event_checkout_return_cancelled");
    expect(trackEvent).not.toHaveBeenCalledWith("event_checkout_return_success");
  });

  it("tracks nothing when there's no payment status at all", () => {
    render(<MapExperience apiKey="test-key" />);

    expect(trackEvent).not.toHaveBeenCalledWith("event_checkout_return_success");
    expect(trackEvent).not.toHaveBeenCalledWith("event_checkout_return_cancelled");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/components/map/ShopMap", () => ({
  ShopMap: ({
    onShopClick,
    onBusinessEventClick,
    onLongPressAdd,
  }: {
    onShopClick: (id: number) => void;
    onBusinessEventClick: (id: string) => void;
    onLongPressAdd?: (lat: number, lng: number) => void;
  }) => (
    <div>
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
  createdAt: null as never,
};

const subscribeShops = vi.fn((onChange: (s: Shop[]) => void) => {
  onChange([shop]);
  return vi.fn();
});
vi.mock("@/lib/firebase/shops", () => ({
  subscribeShops: (...a: [(s: Shop[]) => void]) => subscribeShops(...a),
  trackShopView: vi.fn().mockResolvedValue(1),
  getShopViews: vi.fn().mockResolvedValue(0),
  setShopLikes: vi.fn(),
  setShopUserRatings: vi.fn(),
  setShopComments: vi.fn(),
  setShopUserReviews: vi.fn(),
  deleteShop: vi.fn(),
  createShop: vi.fn(),
  updateShop: vi.fn(),
}));

const subscribeApprovedBusinessEvents = vi.fn((onChange: (e: BusinessEvent[]) => void) => {
  onChange([businessEvent]);
  return vi.fn();
});
vi.mock("@/lib/firebase/businessEvents", () => ({
  subscribeApprovedBusinessEvents: (...a: [(e: BusinessEvent[]) => void]) =>
    subscribeApprovedBusinessEvents(...a),
  trackEventView: vi.fn().mockResolvedValue(undefined),
  incrementEventInterest: vi.fn().mockResolvedValue(undefined),
  incrementEventClicks: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/firebase/firestore", () => ({
  setEventSaved: vi.fn().mockResolvedValue(undefined),
}));

const subscribeUmbrellaEvents = vi.fn((onChange: (u: UmbrellaEvent[]) => void) => {
  onChange([umbrella]);
  return vi.fn();
});
vi.mock("@/lib/firebase/umbrellaEvents", () => ({
  subscribeUmbrellaEvents: (...a: [(u: UmbrellaEvent[]) => void]) => subscribeUmbrellaEvents(...a),
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

vi.mock("@/lib/analytics/trackEvent", () => ({
  trackEvent: vi.fn(),
}));

import { MapExperience } from "@/components/map/MapExperience";

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: false });
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

describe("MapExperience", () => {
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

  it("shows skeleton rows in the sidebar until both shops and events have loaded", () => {
    let shopsCallback: ((s: Shop[]) => void) | null = null;
    subscribeShops.mockImplementation((onChange: (s: Shop[]) => void) => {
      shopsCallback = onChange;
      return vi.fn();
    });

    const { container } = render(<MapExperience apiKey="test-key" />);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);

    act(() => shopsCallback?.([shop]));
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it("does not show the add-shop button for a non-admin", () => {
    render(<MapExperience apiKey="test-key" />);
    expect(screen.queryByText("+ Nieuwe Review Toevoegen")).not.toBeInTheDocument();
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

  it("clears the long-press prefill when the create-shop form is opened via the button instead", async () => {
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("trigger-long-press"));
    expect(await screen.findByDisplayValue("Heuvelplein 1, Tilburg")).toBeInTheDocument();
    await user.click(screen.getByText("Annuleren"));

    await user.click(screen.getByText("+ Nieuwe Review Toevoegen"));
    expect(screen.queryByDisplayValue("Heuvelplein 1, Tilburg")).not.toBeInTheDocument();
  });

  it("lets an admin open the create-shop form, and edit from the detail modal", async () => {
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("+ Nieuwe Review Toevoegen"));
    expect(screen.getByRole("dialog", { name: "Add New Review" })).toBeInTheDocument();
    await user.click(screen.getByText("Annuleren"));

    await user.click(screen.getByText("click-shop"));
    await user.click(screen.getByText("✏️ Bewerken"));
    expect(screen.getByRole("dialog", { name: "Bewerken Review" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test Shop")).toBeInTheDocument();
  });

  it("shows the request-a-review button for a non-admin, not the add-shop button", () => {
    render(<MapExperience apiKey="test-key" />);
    expect(screen.getByText("🥪 Vraag een Review Aan")).toBeInTheDocument();
    expect(screen.queryByText("+ Nieuwe Review Toevoegen")).not.toBeInTheDocument();
  });

  it("does not show the request button for an admin", () => {
    mockUseAuth.mockReturnValue({ currentVisitor: null, isAdmin: true });
    render(<MapExperience apiKey="test-key" />);
    expect(screen.queryByText("🥪 Vraag een Review Aan")).not.toBeInTheDocument();
  });

  it("submits a shop request and shows the confirmation modal", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("🥪 Vraag een Review Aan"));
    await user.type(screen.getByLabelText("Naam van de zaak"), "Nieuwe Broodjeszaak");
    await user.click(screen.getByText("Versturen"));

    expect(await screen.findByRole("dialog", { name: "Bedankt voor je suggestie!" })).toBeInTheDocument();

    await user.click(screen.getByText("Sluiten"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the mobile filter sheet and closes it from the sidebar", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("🔍 Filters"));
    await user.click(screen.getByLabelText("Filters sluiten"));
    expect(screen.getByText("🔍 Filters")).toBeInTheDocument();
  });

  it("selects a shop from the sidebar", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("Test Shop"));
    expect(screen.getByRole("dialog", { name: "Test Shop" })).toBeInTheDocument();
  });

  it("closes the request modal via cancel without submitting", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("🥪 Vraag een Review Aan"));
    await user.click(screen.getByText("Annuleren"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(submitRequest).not.toHaveBeenCalled();
  });
});

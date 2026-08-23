import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/components/map/ShopMap", () => ({
  ShopMap: ({
    onShopClick,
    onBusinessEventClick,
  }: {
    onShopClick: (id: number) => void;
    onBusinessEventClick: (id: string) => void;
  }) => (
    <div>
      <button onClick={() => onShopClick(9001)}>click-shop</button>
      <button onClick={() => onBusinessEventClick("evt1")}>click-event</button>
    </div>
  ),
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
    await user.click(screen.getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the business event detail modal", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("click-event"));
    await user.click(screen.getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the umbrella detail modal", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("click-event"));
    await user.click(screen.getByText(/Onderdeel van Kermis/));
    await user.click(screen.getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("navigates from an event's umbrella badge to the umbrella detail, and back to the event", async () => {
    const user = userEvent.setup();
    render(<MapExperience apiKey="test-key" />);

    await user.click(screen.getByText("click-event"));
    await user.click(screen.getByText(/Onderdeel van Kermis/));
    expect(screen.getByRole("dialog", { name: "🎪 Kermis" })).toBeInTheDocument();

    await user.click(screen.getByText(/Test Event/));
    expect(screen.getByRole("dialog", { name: "🍔 Test Event" })).toBeInTheDocument();
  });

  it("does not show the add-shop button for a non-admin", () => {
    render(<MapExperience apiKey="test-key" />);
    expect(screen.queryByText("+ Nieuwe Review Toevoegen")).not.toBeInTheDocument();
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
});

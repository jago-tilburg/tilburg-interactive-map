import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Shop } from "@/types/shops";
import type { ShopRequest } from "@/types/requests";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

let emittedShops: Shop[] = [];
let emittedRequests: ShopRequest[] = [];
let emittedEvents: BusinessEvent[] = [];
let emittedUmbrellas: UmbrellaEvent[] = [];

const subscribeShops = vi.fn((onChange: (s: Shop[]) => void, ..._rest: [((err: Error) => void)?]) => {
  onChange(emittedShops);
  return vi.fn();
});
const deleteShop = vi.fn();
const getShopViews = vi.fn();
vi.mock("@/lib/firebase/shops", () => ({
  subscribeShops: (...a: [(s: Shop[]) => void, ((err: Error) => void)?]) => subscribeShops(...a),
  deleteShop: (...a: [number]) => deleteShop(...a),
  getShopViews: (...a: [number]) => getShopViews(...a),
  createShop: vi.fn(),
  updateShop: vi.fn(),
}));

const subscribeRequests = vi.fn((onChange: (r: ShopRequest[]) => void, ..._rest: [((err: Error) => void)?]) => {
  onChange(emittedRequests);
  return vi.fn();
});
const deleteRequest = vi.fn();
vi.mock("@/lib/firebase/requests", () => ({
  subscribeRequests: (...a: [(r: ShopRequest[]) => void, ((err: Error) => void)?]) => subscribeRequests(...a),
  deleteRequest: (...a: [string]) => deleteRequest(...a),
}));

const subscribeAllBusinessEventsForAdmin = vi.fn(
  (onChange: (e: BusinessEvent[]) => void, ..._rest: [((err: Error) => void)?]) => {
    onChange(emittedEvents);
    return vi.fn();
  },
);
const createBusinessEvent = vi.fn();
vi.mock("@/lib/firebase/businessEvents", () => ({
  subscribeAllBusinessEventsForAdmin: (...a: [(e: BusinessEvent[]) => void, ((err: Error) => void)?]) =>
    subscribeAllBusinessEventsForAdmin(...a),
  createBusinessEvent: (...a: unknown[]) => createBusinessEvent(...a),
  updateBusinessEvent: vi.fn(),
}));

const subscribeUmbrellaEvents = vi.fn(
  (onChange: (u: UmbrellaEvent[]) => void, ..._rest: [((err: Error) => void)?]) => {
    onChange(emittedUmbrellas);
    return vi.fn();
  },
);
const deleteUmbrellaEvent = vi.fn();
vi.mock("@/lib/firebase/umbrellaEvents", () => ({
  subscribeUmbrellaEvents: (...a: [(u: UmbrellaEvent[]) => void, ((err: Error) => void)?]) =>
    subscribeUmbrellaEvents(...a),
  deleteUmbrellaEvent: (...a: [string]) => deleteUmbrellaEvent(...a),
  createUmbrellaEvent: vi.fn(),
  updateUmbrellaEvent: vi.fn(),
}));

const approveEvent = vi.fn();
const rejectEvent = vi.fn();
vi.mock("@/lib/firebase/functions", () => ({
  approveEvent: (...a: [string]) => approveEvent(...a),
  rejectEvent: (...a: [string]) => rejectEvent(...a),
}));

import { AdminPanel } from "@/components/admin/AdminPanel";

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
    status: "pending",
    paid: false,
    createdAt: null as never,
    ...overrides,
  };
}

const umbrella: UmbrellaEvent = {
  id: "u1",
  title: "Kermis",
  description: "",
  color: "#b45309",
  startDate: "2026-09-01",
  endDate: "2026-09-10",
  createdAt: null as never,
};

beforeEach(() => {
  vi.clearAllMocks();
  emittedShops = [];
  emittedRequests = [];
  emittedEvents = [];
  emittedUmbrellas = [];
  approveEvent.mockResolvedValue(undefined);
  rejectEvent.mockResolvedValue(undefined);
  deleteUmbrellaEvent.mockResolvedValue(undefined);
  deleteShop.mockResolvedValue(undefined);
  deleteRequest.mockResolvedValue(undefined);
  getShopViews.mockResolvedValue(0);
  createBusinessEvent.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ currentUser: { uid: "admin-uid" } });
});

describe("AdminPanel shops tab", () => {
  it("lists shops with view counts and opens the create form", async () => {
    emittedShops = [makeShop()];
    getShopViews.mockResolvedValue(42);
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    expect(screen.getByText("Reviews (1)")).toBeInTheDocument();
    expect(screen.getByText(/Test Shop/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/👁️ 42/)).toBeInTheDocument());

    await user.click(screen.getByText("+ Nieuwe Review Toevoegen"));
    expect(screen.getByRole("dialog", { name: "Add New Review" })).toBeInTheDocument();
  });

  it("opens the edit form pre-filled for a shop", async () => {
    emittedShops = [makeShop()];
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("Bewerken"));
    expect(screen.getByRole("dialog", { name: "Bewerken Review" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test Shop")).toBeInTheDocument();
  });

  it("deletes a shop", async () => {
    emittedShops = [makeShop()];
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("Verwijderen"));
    expect(deleteShop).toHaveBeenCalledWith(9001);
  });

  it("shows an error when deleting a shop fails", async () => {
    emittedShops = [makeShop()];
    deleteShop.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic error when deleting a shop fails with a non-Error", async () => {
    emittedShops = [makeShop()];
    deleteShop.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("Verwijderen mislukt.")).toBeInTheDocument();
  });

  it("closes the shop form via cancel", async () => {
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("+ Nieuwe Review Toevoegen"));
    await user.click(screen.getByText("Annuleren"));
    expect(screen.queryByRole("dialog", { name: "Add New Review" })).not.toBeInTheDocument();
  });

  it("switches back to the shops tab from another tab", async () => {
    emittedShops = [makeShop()];
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("⭐ User Ratings (0)"));
    await user.click(screen.getByText("Reviews (1)"));
    expect(screen.getByText(/Test Shop/)).toBeInTheDocument();
  });
});

describe("AdminPanel userRatings tab", () => {
  it("shows the empty state when there are no ratings", async () => {
    emittedShops = [makeShop({ userRatings: [] })];
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("⭐ User Ratings (0)"));
    expect(screen.getByText("Nog geen ratings van gebruikers ⭐")).toBeInTheDocument();
  });

  it("flattens ratings across all shops", async () => {
    emittedShops = [
      makeShop({ userRatings: [{ userId: "visitor-uid-123", rating: 9, createdAt: 1 }] }),
    ];
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("⭐ User Ratings (1)"));
    expect(screen.getByText(/visitor-/)).toBeInTheDocument();
    expect(screen.getByText(/9 ⭐/)).toBeInTheDocument();
  });

  it("tolerates a shop whose userRatings field is missing entirely", async () => {
    const shopMissingRatings = { ...makeShop() } as Shop;
    // @ts-expect-error -- simulating data from before this field was guaranteed present
    delete shopMissingRatings.userRatings;
    emittedShops = [shopMissingRatings];
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("⭐ User Ratings (0)"));
    expect(screen.getByText("Nog geen ratings van gebruikers ⭐")).toBeInTheDocument();
  });
});

describe("AdminPanel requests tab", () => {
  it("shows the empty state when there are no requests", async () => {
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🥪 Aanvragen (0)"));
    expect(screen.getByText("Nog geen aanvragen 🥪")).toBeInTheDocument();
  });

  it("lists requests sorted newest-first and deletes one", async () => {
    emittedRequests = [
      { firebaseKey: "k1", id: 1, shopName: "Oude Aanvraag", userId: "u1", createdAt: "2026-01-01T00:00:00.000Z" },
      { firebaseKey: "k2", id: 2, shopName: "Nieuwe Aanvraag", userId: "u2", createdAt: "2026-06-01T00:00:00.000Z" },
    ];
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🥪 Aanvragen (2)"));
    const rows = screen.getAllByText(/Aanvraag/);
    expect(rows[0]).toHaveTextContent("Nieuwe Aanvraag");

    await user.click(screen.getAllByText("Verwijderen")[0]);
    expect(deleteRequest).toHaveBeenCalledWith("k2");
  });

  it("shows an error when deleting a request fails", async () => {
    emittedRequests = [
      { firebaseKey: "k1", id: 1, shopName: "Aanvraag", userId: "u1", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    deleteRequest.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🥪 Aanvragen (1)"));
    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic error when deleting a request fails with a non-Error", async () => {
    emittedRequests = [
      { firebaseKey: "k1", id: 1, shopName: "Aanvraag", userId: "u1", createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    deleteRequest.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🥪 Aanvragen (1)"));
    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("Verwijderen mislukt.")).toBeInTheDocument();
  });
});

describe("AdminPanel businessEvents tab", () => {
  it("shows the empty state when there are no events", async () => {
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎉 Bedrijfsevents (0)"));
    expect(screen.getByText("Nog geen bedrijfsevenementen.")).toBeInTheDocument();
  });

  it("shows the quick-add button when signed in, and lets the admin create a quick event", async () => {
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎉 Bedrijfsevents (0)"));
    await user.click(screen.getByText("+ Snel evenement toevoegen"));
    expect(screen.getByRole("dialog", { name: "Nieuw evenement" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Titel"), "Kermis opening");
    await user.type(screen.getByLabelText("Beschrijving"), "Opening van de kermis");
    await user.type(screen.getByLabelText("Startdatum"), "2026-09-01");
    await user.type(screen.getByLabelText("Adres"), "Heuvelplein 1");
    await user.type(screen.getByLabelText("Starttijd"), "10:00");
    await user.type(screen.getByLabelText("Eindtijd"), "18:00");
    await user.type(screen.getByLabelText("Google Maps URL"), "https://maps.google.com/@51.55,5.09,15z");
    await user.click(screen.getByText("Extract"));
    await user.click(screen.getByText("Opslaan"));

    expect(createBusinessEvent).toHaveBeenCalledWith("admin-uid", expect.objectContaining({ title: "Kermis opening" }));
  });

  it("hides the quick-add button when there is no signed-in user", async () => {
    mockUseAuth.mockReturnValue({ currentUser: null });
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎉 Bedrijfsevents (0)"));
    expect(screen.queryByText("+ Snel evenement toevoegen")).not.toBeInTheDocument();
  });

  it("approves and rejects pending events", async () => {
    emittedEvents = [makeEvent({ status: "pending" })];
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎉 Bedrijfsevents (1)"));
    await user.click(screen.getByText("Goedkeuren"));
    expect(approveEvent).toHaveBeenCalledWith("evt1");
  });

  it("shows an error when approving fails", async () => {
    emittedEvents = [makeEvent({ status: "pending" })];
    approveEvent.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎉 Bedrijfsevents (1)"));
    await user.click(screen.getByText("Goedkeuren"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows an error when rejecting fails", async () => {
    emittedEvents = [makeEvent({ status: "pending" })];
    rejectEvent.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎉 Bedrijfsevents (1)"));
    await user.click(screen.getByText("Afwijzen"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows an error when approving fails with a non-Error", async () => {
    emittedEvents = [makeEvent({ status: "pending" })];
    approveEvent.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎉 Bedrijfsevents (1)"));
    await user.click(screen.getByText("Goedkeuren"));
    expect(await screen.findByText("Goedkeuren mislukt.")).toBeInTheDocument();
  });

  it("rejects a pending event and shows a non-Error failure message", async () => {
    emittedEvents = [makeEvent({ status: "pending" })];
    rejectEvent.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎉 Bedrijfsevents (1)"));
    await user.click(screen.getByText("Afwijzen"));
    expect(await screen.findByText("Afwijzen mislukt.")).toBeInTheDocument();
  });

  it("does not show approve/reject for a non-pending event", async () => {
    emittedEvents = [makeEvent({ status: "approved" })];
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎉 Bedrijfsevents (0)"));
    expect(screen.queryByText("Goedkeuren")).not.toBeInTheDocument();
  });
});

describe("AdminPanel umbrellaEvents tab", () => {
  it("lists umbrellas, opens create/edit forms, and deletes one", async () => {
    emittedUmbrellas = [umbrella];
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎪 Grote evenementen (1)"));
    expect(screen.getByText(/Kermis/)).toBeInTheDocument();

    await user.click(screen.getByText("+ Groot evenement toevoegen"));
    expect(screen.getByRole("dialog", { name: "Groot Tilburgs event toevoegen" })).toBeInTheDocument();
    await user.click(screen.getByText("Annuleren"));

    await user.click(screen.getByText("Bewerken"));
    expect(screen.getByRole("dialog", { name: "Groot Tilburgs event bewerken" })).toBeInTheDocument();
    await user.click(screen.getByText("Annuleren"));

    await user.click(screen.getByText("Verwijderen"));
    expect(deleteUmbrellaEvent).toHaveBeenCalledWith("u1");
  });

  it("shows an error when deleting an umbrella event fails", async () => {
    emittedUmbrellas = [umbrella];
    deleteUmbrellaEvent.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎪 Grote evenementen (1)"));
    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic error when deleting an umbrella event fails with a non-Error", async () => {
    emittedUmbrellas = [umbrella];
    deleteUmbrellaEvent.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<AdminPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎪 Grote evenementen (1)"));
    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("Verwijderen mislukt.")).toBeInTheDocument();
  });
});

describe("AdminPanel subscription errors", () => {
  it("surfaces an error from the shops subscription", () => {
    subscribeShops.mockImplementationOnce((_onChange: (s: Shop[]) => void, onError?: (err: Error) => void) => {
      onError?.(new Error("shops listener failed"));
      return vi.fn();
    });
    render(<AdminPanel open onClose={vi.fn()} />);
    expect(screen.getByText("shops listener failed")).toBeInTheDocument();
  });

  it("surfaces an error from the requests subscription", () => {
    subscribeRequests.mockImplementationOnce(
      (_onChange: (r: ShopRequest[]) => void, onError?: (err: Error) => void) => {
        onError?.(new Error("requests listener failed"));
        return vi.fn();
      },
    );
    render(<AdminPanel open onClose={vi.fn()} />);
    expect(screen.getByText("requests listener failed")).toBeInTheDocument();
  });

  it("surfaces an error from the businessEvents subscription", () => {
    subscribeAllBusinessEventsForAdmin.mockImplementationOnce(
      (_onChange: (e: BusinessEvent[]) => void, onError?: (err: Error) => void) => {
        onError?.(new Error("events listener failed"));
        return vi.fn();
      },
    );
    render(<AdminPanel open onClose={vi.fn()} />);
    expect(screen.getByText("events listener failed")).toBeInTheDocument();
  });

  it("surfaces an error from the umbrellaEvents subscription", () => {
    subscribeUmbrellaEvents.mockImplementationOnce(
      (_onChange: (u: UmbrellaEvent[]) => void, onError?: (err: Error) => void) => {
        onError?.(new Error("umbrellas listener failed"));
        return vi.fn();
      },
    );
    render(<AdminPanel open onClose={vi.fn()} />);
    expect(screen.getByText("umbrellas listener failed")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: null, isAdmin: false, currentVisitor: null, currentBusiness: null }),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const submitRequest = vi.fn();
vi.mock("@/lib/firebase/requests", () => ({
  submitRequest: (...a: unknown[]) => submitRequest(...a),
}));

vi.mock("@/lib/firebase/auth", () => ({
  signOutCurrentUser: vi.fn(),
  sendVisitorMagicLink: vi.fn(),
  loginBusiness: vi.fn(),
  registerBusiness: vi.fn(),
  loginAdmin: vi.fn(),
}));

vi.mock("@/lib/firebase/firestore", () => ({
  createBusinessProfile: vi.fn(),
  subscribeVisitorProfile: vi.fn(() => vi.fn()),
}));

vi.mock("@/lib/firebase/businessEvents", () => ({
  subscribeMyBusinessEvents: vi.fn(() => vi.fn()),
  subscribeAllBusinessEventsForAdmin: vi.fn(() => vi.fn()),
  subscribeApprovedBusinessEvents: vi.fn(() => vi.fn()),
  deleteBusinessEvent: vi.fn(),
}));

vi.mock("@/lib/firebase/shops", () => ({
  subscribeShops: vi.fn(() => vi.fn()),
  deleteShop: vi.fn(),
  getShopViews: vi.fn().mockResolvedValue(0),
  createShop: vi.fn(),
  updateShop: vi.fn(),
}));

vi.mock("@/lib/firebase/umbrellaEvents", () => ({
  subscribeUmbrellaEvents: vi.fn(() => vi.fn()),
  createUmbrellaEvent: vi.fn(),
  updateUmbrellaEvent: vi.fn(),
  deleteUmbrellaEvent: vi.fn(),
}));

vi.mock("@/lib/firebase/functions", () => ({
  approveEvent: vi.fn(),
  rejectEvent: vi.fn(),
  confirmEventPaymentStub: vi.fn(),
}));

import { Header } from "@/components/layout/Header";
import { useMapFilterState } from "@/hooks/useMapFilterState";

// Header's filter state is now lifted (shared between MapFilterPanel and the
// hamburger menu it renders) — this harness owns a real, live
// useMapFilterState() so Header doesn't need a filterState prop supplied
// manually in every test.
function Harness(props: Omit<Parameters<typeof Header>[0], "filterState">) {
  const filterState = useMapFilterState();
  return <Header {...props} filterState={filterState} />;
}

function setup(props: Partial<Parameters<typeof Header>[0]> = {}) {
  const onSelectShop = vi.fn();
  const onSelectEvent = vi.fn();
  render(
    <Harness
      shops={[]}
      businessEvents={[]}
      umbrellaEvents={[]}
      onSelectShop={onSelectShop}
      onSelectEvent={onSelectEvent}
      {...props}
    />,
  );
  return { onSelectShop, onSelectEvent };
}

describe("Header", () => {
  it("shows the app title and header actions", () => {
    setup();
    expect(screen.getByText("2 HAPPIES BIJ")).toBeInTheDocument();
    expect(screen.getByText(/Vraag een review aan/)).toBeInTheDocument();
    expect(screen.getByLabelText("Alle 2 Happies")).toBeInTheDocument();
  });

  it("opens the request modal from the header button", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Vraag een review aan/));
    expect(screen.getByRole("dialog", { name: "Vraag een Review Aan" })).toBeInTheDocument();
  });

  it("opens the full list menu from the hamburger button", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByLabelText("Alle 2 Happies"));
    expect(screen.getByRole("dialog", { name: "Alle 2 Happies" })).toBeInTheDocument();
  });

  it("selects a shop from the menu and closes it", async () => {
    const shop = {
      id: 9001,
      name: "Café Zuid",
      address: "Heuvelstraat 1",
      lat: 51.5,
      lng: 5.09,
      rating: 8,
      price: "€€",
      photoUrl: "",
      review: "",
      tiktokUrl: "",
      instagramUrl: "",
      dietaryOptions: { glutenvrij: false, halal: false, vega: false },
      createdAt: "2026-01-01",
      likes: [],
      comments: [],
      userReviews: [],
      userRatings: [],
    };
    const user = userEvent.setup();
    const { onSelectShop } = setup({ shops: [shop] });

    await user.click(screen.getByLabelText("Alle 2 Happies"));
    await user.click(screen.getByText("Café Zuid"));

    expect(onSelectShop).toHaveBeenCalledWith(9001);
    expect(screen.queryByRole("dialog", { name: "Alle 2 Happies" })).not.toBeInTheDocument();
  });

  it("selects an event from the menu and closes it", async () => {
    const event = {
      id: "evt1",
      title: "Kermis Rit",
      category: "anders" as const,
      description: "",
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      startTime: "10:00",
      endTime: "18:00",
      address: "Heuvelplein 1",
      lat: 51.5,
      lng: 5.09,
      ownerId: "owner-uid",
      status: "approved" as const,
      paid: true,
      createdAt: null as never,
    };
    const user = userEvent.setup();
    const { onSelectEvent } = setup({ businessEvents: [event] });

    await user.click(screen.getByLabelText("Alle 2 Happies"));
    await user.click(screen.getByText("Kermis Rit"));

    expect(onSelectEvent).toHaveBeenCalledWith("evt1");
    expect(screen.queryByRole("dialog", { name: "Alle 2 Happies" })).not.toBeInTheDocument();
  });

  it("closes the menu via its own close button", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByLabelText("Alle 2 Happies"));
    await user.click(within(screen.getByRole("dialog", { name: "Alle 2 Happies" })).getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog", { name: "Alle 2 Happies" })).not.toBeInTheDocument();
  });

  it("cancels the request modal without submitting", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Vraag een review aan/));
    await user.click(screen.getByText("Annuleren"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the confirmation modal after submitting a request, then closes it", async () => {
    submitRequest.mockResolvedValue(undefined);
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByText(/Vraag een review aan/));
    await user.type(screen.getByLabelText("Naam van de zaak"), "Nieuwe Broodjeszaak");
    await user.click(screen.getByText("Versturen"));

    expect(await screen.findByRole("dialog", { name: "Bedankt voor je suggestie!" })).toBeInTheDocument();
    await user.click(screen.getByText("Sluiten"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

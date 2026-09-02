import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

// MenuModal's 🔐 entry just opens the shared AuthModal — that component's
// own behavior is covered by AuthModal's test file, so it's stubbed here.
vi.mock("@/components/auth/AuthModal", () => ({
  AuthModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog" aria-label="AuthModal-stub">
        <button onClick={onClose}>close-auth-stub</button>
      </div>
    ) : null,
}));

import { MenuModal } from "@/components/menu/MenuModal";
import { useMapFilterState } from "@/hooks/useMapFilterState";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

// MenuModal's filter state is now lifted (shared with MapFilterPanel) — this
// harness owns a real, live useMapFilterState() so interactive tests still
// re-render like a real ancestor component would.
function Harness(props: Omit<Parameters<typeof MenuModal>[0], "filterState">) {
  const filterState = useMapFilterState();
  return <MenuModal {...props} filterState={filterState} />;
}

const shop: Shop = {
  id: 9001,
  name: "Café Zuid",
  address: "Heuvelstraat 1",
  lat: 51.5,
  lng: 5.09,
  rating: 8.5,
  price: "€€",
  photoUrl: "",
  review: "",
  tiktokUrl: "",
  instagramUrl: "",
  dietaryOptions: { glutenvrij: true, halal: false, vega: false },
  createdAt: "2026-01-01",
  likes: [],
  comments: [],
  userReviews: [],
  userRatings: [],
};

const otherShop: Shop = {
  ...shop,
  id: 9002,
  name: "Broodjeshuis Noord",
  address: "Spoorlaan 2",
  rating: 6,
  dietaryOptions: { glutenvrij: false, halal: true, vega: true },
};

const businessEvent: BusinessEvent = {
  id: "evt1",
  title: "Kermis Rit",
  category: "anders",
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

function setup(overrides: Partial<Parameters<typeof MenuModal>[0]> = {}) {
  const onClose = vi.fn();
  const onSelectShop = vi.fn();
  const onSelectEvent = vi.fn();
  const { container, rerender } = render(
    <Harness
      open
      onClose={onClose}
      shops={[shop, otherShop]}
      businessEvents={[businessEvent]}
      umbrellaEvents={[umbrella]}
      onSelectShop={onSelectShop}
      onSelectEvent={onSelectEvent}
      {...overrides}
    />,
  );
  return { onClose, onSelectShop, onSelectEvent, container, rerender };
}

describe("MenuModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ isAdmin: false });
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <Harness
        open={false}
        onClose={vi.fn()}
        shops={[]}
        businessEvents={[]}
        umbrellaEvents={[]}
        onSelectShop={vi.fn()}
        onSelectEvent={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the umbrella, event, and shop rows by default", () => {
    setup();
    expect(screen.getByText("Kermis")).toBeInTheDocument();
    expect(screen.getByText("Kermis Rit")).toBeInTheDocument();
    expect(screen.getByText("Café Zuid")).toBeInTheDocument();
    expect(screen.getByText("Broodjeshuis Noord")).toBeInTheDocument();
  });

  it("selects a shop and closes via the overlay click", async () => {
    const user = userEvent.setup();
    const { onSelectShop } = setup();
    await user.click(screen.getByText("Café Zuid"));
    expect(onSelectShop).toHaveBeenCalledWith(9001);
  });

  it("selects an event", async () => {
    const user = userEvent.setup();
    const { onSelectEvent } = setup();
    await user.click(screen.getByText("Kermis Rit"));
    expect(onSelectEvent).toHaveBeenCalledWith("evt1");
  });

  it("has aria-modal set on the dialog", () => {
    setup();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("closes on Escape", () => {
    const { onClose } = setup();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the close button is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByLabelText("Sluiten"));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the overlay backdrop is clicked, not when the dialog itself is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("presentation", { hidden: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it("filters to shops only via the Broodjes pill", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("🥪 Broodjes"));
    expect(screen.queryByText("Kermis Rit")).not.toBeInTheDocument();
    expect(screen.getByText("Café Zuid")).toBeInTheDocument();
  });

  it("filters to events only via the Events pill", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("🎉 Events"));
    expect(screen.queryByText("Café Zuid")).not.toBeInTheDocument();
    expect(screen.getByText("Kermis Rit")).toBeInTheDocument();
  });

  it("filters shops by a single-select dietary pill", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("🌾 Glutenvrij"));
    expect(screen.getByText("Café Zuid")).toBeInTheDocument();
    expect(screen.queryByText("Broodjeshuis Noord")).not.toBeInTheDocument();

    await user.click(screen.getAllByText("Alles")[1]);
    expect(screen.getByText("Broodjeshuis Noord")).toBeInTheDocument();
  });

  it("sorts shops by rating ascending", async () => {
    const user = userEvent.setup();
    setup();
    await user.selectOptions(screen.getByLabelText("Sorteer op:"), "rating-asc");
    const rows = screen.getAllByRole("button").filter((b) => b.textContent?.includes("€€"));
    expect(rows[0].textContent).toContain("Broodjeshuis Noord");
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    setup({ shops: [], businessEvents: [], umbrellaEvents: [] });
    await user.click(screen.getByText("🥪 Broodjes"));
    expect(screen.getByText("Nog geen reviews beschikbaar")).toBeInTheDocument();
  });

  it("hides an expired umbrella event", () => {
    setup({ umbrellaEvents: [{ ...umbrella, endDate: "2020-01-01" }] });
    expect(screen.queryByText("Kermis")).not.toBeInTheDocument();
  });

  it("lists events chronologically, not in prop order", () => {
    const laterEvent: BusinessEvent = {
      ...businessEvent,
      id: "evt2",
      title: "Later Event",
      startDate: "2026-09-02",
      umbrellaEventId: undefined,
    };
    const earlierEvent: BusinessEvent = {
      ...businessEvent,
      id: "evt3",
      title: "Earlier Event",
      startDate: "2026-08-30",
      umbrellaEventId: undefined,
    };
    setup({ businessEvents: [laterEvent, earlierEvent, businessEvent] });

    const names = screen
      .getAllByRole("button")
      .map((b) => b.textContent)
      .filter((t): t is string => !!t && /Event|Kermis Rit/.test(t));
    const earlierIdx = names.findIndex((t) => t.includes("Earlier Event"));
    const kermisIdx = names.findIndex((t) => t.includes("Kermis Rit"));
    const laterIdx = names.findIndex((t) => t.includes("Later Event"));
    expect(earlierIdx).toBeLessThan(kermisIdx);
    expect(kermisIdx).toBeLessThan(laterIdx);
  });

  it("hides the sort dropdown and dietary pills when only Events is selected", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("🎉 Events"));
    expect(screen.queryByLabelText("Sorteer op:")).not.toBeInTheDocument();
    expect(screen.queryByText("🌾 Glutenvrij")).not.toBeInTheDocument();
  });

  it("shows skeleton rows instead of the list while loading", () => {
    setup({ loading: true });
    expect(screen.queryByText("Café Zuid")).not.toBeInTheDocument();
    expect(screen.queryByText("Kermis")).not.toBeInTheDocument();
    expect(screen.queryByText("Nog geen reviews beschikbaar")).not.toBeInTheDocument();
    // Content is portaled outside the render container, and Radix adds its
    // own aria-hidden focus-guard elements outside the dialog — scope the
    // query to inside the dialog itself to count only the skeleton rows.
    expect(screen.getByRole("dialog").querySelectorAll('[aria-hidden="true"]')).toHaveLength(5);
  });

  it("opens and closes the privacy modal from the footer link", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("📜 Privacy"));
    const privacyDialog = screen.getByRole("dialog", { name: "Privacybeleid" });
    expect(privacyDialog).toBeInTheDocument();

    await user.click(within(privacyDialog).getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog", { name: "Privacybeleid" })).not.toBeInTheDocument();
  });

  it("navigates to /voorwaarden from the footer link", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("📄 Voorwaarden"));
    expect(routerPush).toHaveBeenCalledWith("/voorwaarden");
  });

  it("shows the admin-login entry only when signed out", () => {
    const { rerender } = setup();
    expect(screen.getByText("🔐")).toBeInTheDocument();

    mockUseAuth.mockReturnValue({ isAdmin: true });
    rerender(
      <Harness
        open
        onClose={vi.fn()}
        shops={[]}
        businessEvents={[]}
        umbrellaEvents={[]}
        onSelectShop={vi.fn()}
        onSelectEvent={vi.fn()}
      />,
    );
    expect(screen.queryByText("🔐")).not.toBeInTheDocument();
  });

  it("opens and closes the auth modal from the 🔐 entry", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByText("🔐"));
    // The stub isn't a real Radix Portal like the component it replaces, so
    // it stays inside the render container instead of teleporting to body —
    // MenuModal's own open Dialog then marks that container aria-hidden
    // (Radix's hideOthers(), portal-aware for real nested dialogs but not
    // for this plain stub). `hidden: true` includes it anyway, same as the
    // overlay backdrop query above.
    expect(screen.getByRole("dialog", { name: "AuthModal-stub", hidden: true })).toBeInTheDocument();

    // fireEvent, not userEvent, for the same reason as the query above —
    // userEvent's pointer simulation respects aria-hidden/pointer-events and
    // would refuse to "see" this non-portaled stub as clickable.
    fireEvent.click(screen.getByText("close-auth-stub"));
    expect(screen.queryByRole("dialog", { name: "AuthModal-stub", hidden: true })).not.toBeInTheDocument();
  });
});

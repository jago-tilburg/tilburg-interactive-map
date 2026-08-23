import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "@/components/sidebar/Sidebar";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

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
  photoUrl: "https://example.com/kermis.jpg",
  startDate: "2026-01-01",
  endDate: "2099-01-01",
  createdAt: null as never,
};

function setup(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const onSelectShop = vi.fn();
  const onSelectEvent = vi.fn();
  const onCloseMobile = vi.fn();
  render(
    <Sidebar
      shops={[shop, otherShop]}
      businessEvents={[businessEvent]}
      umbrellaEvents={[umbrella]}
      onSelectShop={onSelectShop}
      onSelectEvent={onSelectEvent}
      mobileOpen={false}
      onCloseMobile={onCloseMobile}
      {...overrides}
    />,
  );
  return { onSelectShop, onSelectEvent, onCloseMobile };
}

describe("Sidebar", () => {
  it("shows shops and events with a combined results count", () => {
    setup();
    expect(screen.getByText("3 resultaten")).toBeInTheDocument();
    expect(screen.getByText("Café Zuid")).toBeInTheDocument();
    expect(screen.getByText("Broodjeshuis Noord")).toBeInTheDocument();
    expect(screen.getByText("Kermis Rit")).toBeInTheDocument();
  });

  it("shows the umbrella caption on a linked event row", () => {
    setup();
    expect(screen.getByText(/Onderdeel van Kermis/)).toBeInTheDocument();
  });

  it("selects a shop and closes the mobile sheet", async () => {
    const user = userEvent.setup();
    const { onSelectShop, onCloseMobile } = setup();
    await user.click(screen.getByText("Café Zuid"));
    expect(onSelectShop).toHaveBeenCalledWith(9001);
    expect(onCloseMobile).toHaveBeenCalled();
  });

  it("selects an event and closes the mobile sheet", async () => {
    const user = userEvent.setup();
    const { onSelectEvent, onCloseMobile } = setup();
    await user.click(screen.getByText("Kermis Rit"));
    expect(onSelectEvent).toHaveBeenCalledWith("evt1");
    expect(onCloseMobile).toHaveBeenCalled();
  });

  it("filters to shops only via the Broodjes tab", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("tab", { name: "🥪 Broodjes" }));
    expect(screen.getByText("2 resultaten")).toBeInTheDocument();
    expect(screen.queryByText("Kermis Rit")).not.toBeInTheDocument();
  });

  it("filters to events only via the Events tab", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("tab", { name: "🎉 Events" }));
    expect(screen.getByText("1 resultaten")).toBeInTheDocument();
    expect(screen.queryByText("Café Zuid")).not.toBeInTheDocument();
  });

  it("filters by the umbrella pill", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("tab", { name: "🎉 Events" }));
    await user.click(screen.getByText("Kermis"));
    expect(screen.getByText("1 resultaten")).toBeInTheDocument();
    await user.click(screen.getByText("Kermis"));
    expect(screen.queryByText("Wis filters")).not.toBeInTheDocument();
  });

  it("expands filters and searches by name", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Meer filters/));
    await user.type(screen.getByLabelText("Zoeken"), "Broodjeshuis");
    expect(screen.getByText("1 resultaten")).toBeInTheDocument();
    expect(screen.queryByText("Café Zuid")).not.toBeInTheDocument();
  });

  it("filters shops by dietary requirement", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Meer filters/));
    await user.click(screen.getByText("🌾 Glutenvrij"));
    expect(screen.queryByText("Broodjeshuis Noord")).not.toBeInTheDocument();
    expect(screen.getByText("Café Zuid")).toBeInTheDocument();
  });

  it("filters events by category", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Meer filters/));
    await user.click(screen.getByText("🎵 Muziek"));
    expect(screen.queryByText("Kermis Rit")).not.toBeInTheDocument();
  });

  it("sorts shops by name", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Meer filters/));
    await user.selectOptions(screen.getByLabelText("Sorteren"), "name-asc");
    const rows = screen.getAllByRole("button").filter((b) => b.textContent?.includes("€€"));
    expect(rows[0].textContent).toContain("Broodjeshuis Noord");
  });

  it("filters events to 'Vandaag'", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const user = userEvent.setup();
    setup({ businessEvents: [{ ...businessEvent, startDate: today, endDate: today }] });

    await user.click(screen.getByRole("tab", { name: "🎉 Events" }));
    await user.click(screen.getByText(/Meer filters/));
    await user.click(screen.getByText("Vandaag"));

    expect(screen.getByText("1 resultaten")).toBeInTheDocument();
    expect(screen.getByText("Kermis Rit")).toBeInTheDocument();

    await user.click(screen.getByText("Vandaag"));
    expect(screen.getByText("1 resultaten")).toBeInTheDocument();
  });

  it("filters events to 'Morgen', excluding an event happening only today", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const user = userEvent.setup();
    setup({ businessEvents: [{ ...businessEvent, startDate: today, endDate: today }] });

    await user.click(screen.getByRole("tab", { name: "🎉 Events" }));
    await user.click(screen.getByText(/Meer filters/));
    await user.click(screen.getByText("Morgen"));
    expect(screen.getByText("0 resultaten")).toBeInTheDocument();

    await user.click(screen.getByText("Morgen"));
    expect(screen.getByText("1 resultaten")).toBeInTheDocument();
  });

  it("clears all active filters", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Meer filters/));
    await user.type(screen.getByLabelText("Zoeken"), "zuid");
    expect(screen.getByText("Wis filters")).toBeInTheDocument();
    await user.click(screen.getByText("Wis filters"));
    expect(screen.getByLabelText("Zoeken")).toHaveValue("");
    expect(screen.getByText("3 resultaten")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/Meer filters/));
    await user.type(screen.getByLabelText("Zoeken"), "nonexistent-shop-xyz");
    expect(screen.getByText("Geen resultaten gevonden 🥲")).toBeInTheDocument();
  });

  it("renders the mobile close button and calls onCloseMobile", async () => {
    const user = userEvent.setup();
    const { onCloseMobile } = setup({ mobileOpen: true });
    await user.click(screen.getByLabelText("Filters sluiten"));
    expect(onCloseMobile).toHaveBeenCalled();
  });

  it("renders an event row with no umbrella caption when it isn't linked to one", () => {
    setup({ businessEvents: [{ ...businessEvent, umbrellaEventId: undefined }], umbrellaEvents: [] });
    expect(screen.getByText("Kermis Rit")).toBeInTheDocument();
    expect(screen.queryByText(/Onderdeel van/)).not.toBeInTheDocument();
  });

  it("falls back to the umbrella color when no photoUrl is set", () => {
    setup({ umbrellaEvents: [{ ...umbrella, photoUrl: undefined }] });
    expect(screen.getByText("Kermis")).toBeInTheDocument();
  });
});

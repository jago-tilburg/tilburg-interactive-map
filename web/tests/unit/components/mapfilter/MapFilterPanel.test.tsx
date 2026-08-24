import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapFilterPanel } from "@/components/mapfilter/MapFilterPanel";
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

function setup(overrides: Partial<Parameters<typeof MapFilterPanel>[0]> = {}) {
  const onCloseMobile = vi.fn();
  const onOpenMobile = vi.fn();
  const onFilteredResultsChange = vi.fn();
  const utils = render(
    <MapFilterPanel
      shops={[shop, otherShop]}
      businessEvents={[businessEvent]}
      umbrellaEvents={[umbrella]}
      mobileOpen={false}
      onOpenMobile={onOpenMobile}
      onCloseMobile={onCloseMobile}
      onFilteredResultsChange={onFilteredResultsChange}
      {...overrides}
    />,
  );
  return { onCloseMobile, onOpenMobile, onFilteredResultsChange, ...utils };
}

describe("MapFilterPanel", () => {
  it("reports the full unfiltered results by default", () => {
    const { onFilteredResultsChange } = setup();
    const lastCall = onFilteredResultsChange.mock.calls.at(-1)!;
    expect(lastCall[0]).toEqual([shop, otherShop]);
    expect(lastCall[1]).toEqual([businessEvent]);
  });

  it("shows a combined results count", () => {
    setup();
    expect(screen.getByText("3 resultaten")).toBeInTheDocument();
  });

  it("filters to only shops when the Broodjes pill is toggled", async () => {
    const user = userEvent.setup();
    const { onFilteredResultsChange } = setup();

    await user.click(screen.getByText(/🥪 Broodjes/));
    expect(screen.getByText("2 resultaten")).toBeInTheDocument();
    const lastCall = onFilteredResultsChange.mock.calls.at(-1)!;
    expect(lastCall[0]).toEqual([shop, otherShop]);
    expect(lastCall[1]).toEqual([]);

    await user.click(screen.getByText(/🥪 Broodjes/));
    expect(screen.getByText("3 resultaten")).toBeInTheDocument();
  });

  it("filters to only events when the Events pill is toggled, then back to all", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByText(/🎉 Events/));
    expect(screen.getByText("1 resultaten")).toBeInTheDocument();

    await user.click(screen.getByText(/🎉 Events/));
    expect(screen.getByText("3 resultaten")).toBeInTheDocument();
  });

  it("filters by the umbrella pill, excluding events not linked to it and hiding shops entirely", async () => {
    const unrelatedEvent: BusinessEvent = { ...businessEvent, id: "evt2", umbrellaEventId: undefined };
    const user = userEvent.setup();
    setup({ businessEvents: [businessEvent, unrelatedEvent] });

    expect(screen.getByText("4 resultaten")).toBeInTheDocument();

    // A groot event never contains shops, so selecting one hides both the
    // 2 shops and the unrelated event, leaving just the 1 linked event.
    await user.click(screen.getByText("Kermis"));
    expect(screen.getByText("1 resultaten")).toBeInTheDocument();

    await user.click(screen.getByText("Kermis"));
    expect(screen.getByText("4 resultaten")).toBeInTheDocument();
  });

  it("does not show umbrella pills for a broodjes-only filter", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText(/🥪 Broodjes/));
    expect(screen.queryByText("Kermis")).not.toBeInTheDocument();
  });

  it("expands 'Meer filters' and searches by name", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByText("Meer filters"));
    await user.type(screen.getByLabelText("Zoeken"), "Broodjeshuis");

    expect(screen.getByText("1 resultaten")).toBeInTheDocument();
  });

  it("filters shops by a dietary checkbox", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByText("Meer filters"));
    await user.click(screen.getByLabelText(/🌾 Glutenvrij/));

    expect(screen.getByText("2 resultaten")).toBeInTheDocument();
  });

  it("filters events by a category checkbox, excluding non-matching categories", async () => {
    // A zero-result category checkbox is hidden (matches the prototype), so
    // add an "eten" event to give that checkbox something to show/hide.
    const foodEvent: BusinessEvent = { ...businessEvent, id: "evt2", category: "eten", umbrellaEventId: undefined };
    const user = userEvent.setup();
    setup({ businessEvents: [businessEvent, foodEvent] });

    await user.click(screen.getByText("Meer filters"));
    await user.click(screen.getByLabelText(/🍔 Eten & Drinken/));

    // "anders" (businessEvent) is excluded, leaving the 2 shops + foodEvent.
    expect(screen.getByText("3 resultaten")).toBeInTheDocument();

    await user.click(screen.getByLabelText(/🍔 Eten & Drinken/));
    expect(screen.getByText("4 resultaten")).toBeInTheDocument();
  });

  it("filters events to 'Vandaag'", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const user = userEvent.setup();
    setup({ businessEvents: [{ ...businessEvent, startDate: today, endDate: today }] });

    await user.click(screen.getByText("Meer filters"));
    await user.click(screen.getByLabelText(/Vandaag/));
    expect(screen.getByText("3 resultaten")).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Vandaag/));
    expect(screen.getByText("3 resultaten")).toBeInTheDocument();
  });

  it("toggles 'Morgen' on and off", async () => {
    // A zero-result "Morgen" checkbox is hidden (matches the prototype), so
    // give it an event that actually occurs tomorrow.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const user = userEvent.setup();
    setup({ businessEvents: [{ ...businessEvent, startDate: tomorrowStr, endDate: tomorrowStr }] });

    await user.click(screen.getByText("Meer filters"));
    await user.click(screen.getByLabelText(/Morgen/));
    expect(screen.getByLabelText(/Morgen/)).toBeChecked();

    await user.click(screen.getByLabelText(/Morgen/));
    expect(screen.getByLabelText(/Morgen/)).not.toBeChecked();
  });

  it("opens the calendar popover and picks a specific date", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const user = userEvent.setup();
    setup({ businessEvents: [{ ...businessEvent, startDate: today, endDate: today }] });

    await user.click(screen.getByText("Meer filters"));
    await user.click(screen.getByText(/Kies specifieke datum/));

    const day = Number(today.slice(-2));
    await user.click(screen.getByText(String(day)));

    expect(screen.getByText("3 resultaten")).toBeInTheDocument();
  });

  it("clears all active filters", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByText("Meer filters"));
    await user.type(screen.getByLabelText("Zoeken"), "zuid");
    expect(screen.getByText("Wis filters")).toBeInTheDocument();

    await user.click(screen.getByText("Wis filters"));
    expect(screen.getByLabelText("Zoeken")).toHaveValue("");
    expect(screen.getByText("3 resultaten")).toBeInTheDocument();
  });

  it("toggles 'Meer filters' via the chevron button without bubbling to the header row", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByText("▼"));
    expect(screen.getByLabelText("Zoeken")).toBeInTheDocument();

    await user.click(screen.getByText("▼"));
    expect(screen.queryByLabelText("Zoeken")).not.toBeInTheDocument();
  });

  it("collapses 'Meer filters' again on a second click", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByText("Meer filters"));
    expect(screen.getByLabelText("Zoeken")).toBeInTheDocument();

    await user.click(screen.getByText("Meer filters"));
    expect(screen.queryByLabelText("Zoeken")).not.toBeInTheDocument();
  });

  it("shows the mobile toggle button and opens the mobile sheet", async () => {
    const user = userEvent.setup();
    const { onOpenMobile } = setup();

    await user.click(screen.getByText("🔍 Filters"));
    expect(onOpenMobile).toHaveBeenCalled();
  });

  it("hides the mobile toggle button and shows the mobile close button when open", async () => {
    const user = userEvent.setup();
    const { onCloseMobile } = setup({ mobileOpen: true });

    expect(screen.queryByText("🔍 Filters")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Filters sluiten"));
    expect(onCloseMobile).toHaveBeenCalled();
  });

  it("shows the full filter body in the open mobile sheet without needing 'Meer filters'", () => {
    // On mobile the "Meer filters" toggle is CSS-hidden entirely (see
    // MapFilterPanel.module.css) — the open sheet must show the body
    // unconditionally, not stay gated behind the desktop collapse state.
    setup({ mobileOpen: true });
    expect(screen.getByLabelText("Zoeken")).toBeInTheDocument();
  });

  it("counts the Broodjes/Events toggle itself as an active filter", async () => {
    const user = userEvent.setup();
    setup();

    expect(screen.queryByText("Wis filters")).not.toBeInTheDocument();
    await user.click(screen.getByText(/🎉 Events/));
    expect(screen.getByText("Wis filters")).toBeInTheDocument();
  });

  it("closes the mobile sheet via the 'Toon resultaten' button", async () => {
    const user = userEvent.setup();
    const { onCloseMobile } = setup({ mobileOpen: true });

    await user.click(screen.getByText("Toon resultaten"));
    expect(onCloseMobile).toHaveBeenCalled();
  });

  it("falls back to the umbrella color when no photoUrl is set", () => {
    setup({ umbrellaEvents: [{ ...umbrella, photoUrl: undefined }] });
    expect(screen.getByText("Kermis")).toBeInTheDocument();
  });
});

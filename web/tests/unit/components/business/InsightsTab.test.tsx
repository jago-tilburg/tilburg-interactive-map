import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BusinessEvent } from "@/types/events";

const showToast = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast }),
}));

const deleteBusinessEvent = vi.fn();
vi.mock("@/lib/firebase/businessEvents", () => ({
  deleteBusinessEvent: (...a: unknown[]) => deleteBusinessEvent(...a),
  trackEventView: vi.fn().mockResolvedValue(undefined),
  incrementEventInterest: vi.fn().mockResolvedValue(undefined),
  incrementEventClicks: vi.fn().mockResolvedValue(undefined),
}));

const createCheckoutSession = vi.fn();
vi.mock("@/lib/firebase/functions", () => ({
  createCheckoutSession: (...a: unknown[]) => createCheckoutSession(...a),
}));

vi.mock("@/lib/firebase/firestore", () => ({
  setEventSaved: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: null, isAdmin: false }),
}));

import { InsightsTab } from "@/components/business/InsightsTab";

function makeEvent(overrides: Partial<BusinessEvent> = {}): BusinessEvent {
  return {
    id: "evt1",
    title: "Test Event",
    category: "eten",
    description: "A test event",
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    startTime: "10:00",
    endTime: "18:00",
    address: "Heuvelplein 1",
    lat: 51.5,
    lng: 5.09,
    ownerId: "u1",
    city: "Tilburg",
    status: "pending",
    paid: false,
    createdAt: null as never,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createCheckoutSession.mockResolvedValue("https://checkout.stripe.com/session123");
  deleteBusinessEvent.mockResolvedValue(undefined);
});

function setup(events: BusinessEvent[] = [], overrides: Record<string, unknown> = {}) {
  const onCreate = vi.fn();
  const onEdit = vi.fn();
  const onDuplicate = vi.fn();
  render(
    <InsightsTab
      events={events}
      umbrellaEvents={[]}
      onCreate={onCreate}
      onEdit={onEdit}
      onDuplicate={onDuplicate}
      {...overrides}
    />,
  );
  return { onCreate, onEdit, onDuplicate };
}

describe("InsightsTab", () => {
  it("shows the empty state when there are no events", () => {
    setup([]);
    expect(screen.getByText(/Nog geen evenementen/)).toBeInTheDocument();
  });

  it("calls onCreate from the '+ Nieuw evenement' button", async () => {
    const user = userEvent.setup();
    const { onCreate } = setup([]);
    await user.click(screen.getByText("+ Nieuw evenement"));
    expect(onCreate).toHaveBeenCalled();
  });

  it("calls onEdit with the event", async () => {
    const ev = makeEvent();
    const user = userEvent.setup();
    const { onEdit } = setup([ev]);
    await user.click(screen.getByText("Bewerken"));
    expect(onEdit).toHaveBeenCalledWith(ev);
  });

  it("calls onDuplicate with the event", async () => {
    const ev = makeEvent();
    const user = userEvent.setup();
    const { onDuplicate } = setup([ev]);
    await user.click(screen.getByText("Dupliceren"));
    expect(onDuplicate).toHaveBeenCalledWith(ev);
  });

  it("deletes an event", async () => {
    const user = userEvent.setup();
    setup([makeEvent()]);
    await user.click(screen.getByText("Verwijderen"));
    expect(deleteBusinessEvent).toHaveBeenCalledWith("evt1");
  });

  it("shows an error message when deleting fails", async () => {
    deleteBusinessEvent.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    setup([makeEvent()]);
    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic error message when a non-Error is thrown while deleting", async () => {
    deleteBusinessEvent.mockRejectedValue("nope");
    const user = userEvent.setup();
    setup([makeEvent()]);
    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("Verwijderen mislukt.")).toBeInTheDocument();
  });

  it("shows the pay button only for a pending, unpaid event, and redirects to the Stripe Checkout URL", async () => {
    const user = userEvent.setup();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, href: "" },
      writable: true,
      configurable: true,
    });
    setup([makeEvent({ status: "pending", paid: false })]);

    await user.click(screen.getByText("Betalen"));

    expect(createCheckoutSession).toHaveBeenCalledWith("evt1");
    expect(window.location.href).toBe("https://checkout.stripe.com/session123");

    Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
  });

  it("shows a paid label instead of the pay button once paid", () => {
    setup([makeEvent({ status: "approved", paid: true })]);
    expect(screen.getByText(/Betaald, live op de kaart/)).toBeInTheDocument();
    expect(screen.queryByText("Betalen")).not.toBeInTheDocument();
  });

  it("shows an error message when creating the checkout session fails", async () => {
    createCheckoutSession.mockRejectedValue(new Error("payment gateway down"));
    const user = userEvent.setup();
    setup([makeEvent({ status: "pending", paid: false })]);
    await user.click(screen.getByText("Betalen"));
    expect(await screen.findByText("payment gateway down")).toBeInTheDocument();
  });

  it("shows a generic error message when a non-Error is thrown while paying", async () => {
    createCheckoutSession.mockRejectedValue("nope");
    const user = userEvent.setup();
    setup([makeEvent({ status: "pending", paid: false })]);
    await user.click(screen.getByText("Betalen"));
    expect(await screen.findByText("Betalen mislukt.")).toBeInTheDocument();
  });

  it("opens and closes the event detail modal when the title is clicked", async () => {
    const user = userEvent.setup();
    setup([makeEvent()]);
    await user.click(screen.getByText(/🍔 Test Event/));
    expect(screen.getByRole("dialog", { name: "🍔 Test Event" })).toBeInTheDocument();
    await user.click(screen.getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog", { name: "🍔 Test Event" })).not.toBeInTheDocument();
  });

  it("shows KPI totals across events and per-event view/click/interest/share stats", () => {
    // "Live" requires both approved AND paid.
    setup([
      makeEvent({ id: "evt1", status: "approved", paid: true, views: 10, clicks: 3, interest: 2, shares: 4 }),
      makeEvent({ id: "evt2", status: "pending", views: 5, clicks: 1, interest: 0, shares: 2 }),
    ]);

    expect(screen.getByText("1")).toBeInTheDocument(); // Live events
    expect(screen.getByText("15")).toBeInTheDocument(); // Views totaal
    expect(screen.getByText("4")).toBeInTheDocument(); // Klikken totaal
    expect(screen.getByText("6")).toBeInTheDocument(); // Shares totaal
    expect(screen.getByText("👁️ 10 · 🔗 3 · ❤️ 2 · 📤 4")).toBeInTheDocument();
    expect(screen.getByText("👁️ 5 · 🔗 1 · ❤️ 0 · 📤 2")).toBeInTheDocument();
  });

  it("shows zeroed stats when an event has no counters yet", () => {
    setup([makeEvent({ id: "evt1", status: "pending" })]);
    expect(screen.getByText("👁️ 0 · 🔗 0 · ❤️ 0 · 📤 0")).toBeInTheDocument();
  });

  it("filters the event list via the filter chips, matching each chip's own count", async () => {
    const user = userEvent.setup();
    setup([
      makeEvent({ id: "evt1", title: "Live One", status: "approved", paid: true }),
      makeEvent({ id: "evt2", title: "Pending One", status: "pending" }),
      makeEvent({ id: "evt3", title: "Rejected One", status: "rejected" }),
    ]);

    expect(screen.getByText("Alles (3)")).toBeInTheDocument();
    expect(screen.getByText("Live (1)")).toBeInTheDocument();
    expect(screen.getByText("In afwachting (1)")).toBeInTheDocument();
    expect(screen.getByText("Afgewezen (1)")).toBeInTheDocument();

    await user.click(screen.getByText("Live (1)"));
    expect(screen.getByText(/Live One/)).toBeInTheDocument();
    expect(screen.queryByText(/Pending One/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rejected One/)).not.toBeInTheDocument();

    await user.click(screen.getByText("Afgewezen (1)"));
    expect(screen.getByText(/Rejected One/)).toBeInTheDocument();
    expect(screen.queryByText(/Live One/)).not.toBeInTheDocument();

    await user.click(screen.getByText("In afwachting (1)"));
    expect(screen.getByText(/Pending One/)).toBeInTheDocument();
    expect(screen.queryByText(/Live One/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Rejected One/)).not.toBeInTheDocument();
  });

  it("shows the empty-filter message when a chip matches nothing", async () => {
    const user = userEvent.setup();
    setup([makeEvent({ status: "pending" })]);
    await user.click(screen.getByText("Live (0)"));
    expect(screen.getByText("Geen events in dit filter.")).toBeInTheDocument();
  });

  it("shows the rejection reason on a rejected event, when the admin gave one", () => {
    setup([
      makeEvent({ id: "evt1", status: "rejected", rejectionReason: "Adres onvindbaar" }),
      makeEvent({ id: "evt2", status: "rejected" }),
    ]);
    expect(screen.getByText("Reden voor afwijzing: Adres onvindbaar")).toBeInTheDocument();
    expect(screen.queryAllByText(/^Reden voor afwijzing:/)).toHaveLength(1);
  });

  it("sorts events newest-first by createdAt", () => {
    const older = { toMillis: () => 1000 } as unknown as BusinessEvent["createdAt"];
    const newer = { toMillis: () => 2000 } as unknown as BusinessEvent["createdAt"];
    setup([
      makeEvent({ id: "evt-old", title: "Older Event", createdAt: older }),
      makeEvent({ id: "evt-new", title: "Newer Event", createdAt: newer }),
    ]);

    const titles = screen.getAllByText(/Older Event|Newer Event/).map((el) => el.textContent);
    expect(titles.join("|")).toMatch(/Newer Event[\s\S]*Older Event/);
  });
});

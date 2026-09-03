import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BusinessEvent } from "@/types/events";
import type { PendingPhoto } from "@/components/common/PhotoUploadField";

const createBusinessEvent = vi.fn();
const updateBusinessEvent = vi.fn();
vi.mock("@/lib/firebase/businessEvents", () => ({
  createBusinessEvent: (...a: unknown[]) => createBusinessEvent(...a),
  updateBusinessEvent: (...a: unknown[]) => updateBusinessEvent(...a),
}));

const createCheckoutSession = vi.fn();
vi.mock("@/lib/firebase/functions", () => ({
  createCheckoutSession: (...a: unknown[]) => createCheckoutSession(...a),
}));

const resolvePhotoUpdate = vi.fn();
vi.mock("@/lib/photos/resolvePhotoUpdate", () => ({
  resolvePhotoUpdate: (...a: unknown[]) => resolvePhotoUpdate(...a),
}));

const trackEvent = vi.fn();
vi.mock("@/lib/analytics/trackEvent", () => ({
  trackEvent: (...a: unknown[]) => trackEvent(...a),
}));

const geocodeAddress = vi.fn();
vi.mock("@/lib/maps/geocodeAddress", () => ({
  geocodeAddress: (...a: unknown[]) => geocodeAddress(...a),
}));

const showToast = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("@/components/common/PhotoUploadField", () => ({
  PhotoUploadField: (_props: { onPendingPhotoChange: (p: PendingPhoto | null) => void }) => <div />,
}));

vi.mock("@/components/events/BusinessEventDetailModal", () => ({
  BusinessEventDetailModal: (props: { open: boolean; onClose: () => void; event: { title: string }; previewMode?: boolean }) =>
    props.open ? (
      <div data-testid="preview-modal">
        title={props.event.title} previewMode={String(props.previewMode)}
        <button type="button" onClick={props.onClose}>
          stub-close
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/map/EventMarkerPreview", () => ({
  EventMarkerPreview: () => <div data-testid="marker-preview" />,
}));

import { BusinessEventForm } from "@/components/events/BusinessEventForm";

function makeEvent(overrides: Partial<BusinessEvent> = {}): BusinessEvent {
  return {
    id: "evt1",
    title: "Original Event",
    category: "eten",
    description: "desc",
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

// The identity-resync block (PLAN-INLOGGEN.md §9's "active" gate, ported
// from the old modal's `open` gate) only fires when the form's identity
// changes while it stays mounted and active — e.g. reused in an
// already-open dialog, or (once /eventbeheer exists) a Radix Presence exit
// animation keeping it mounted one tick past active flipping false. Neither
// the ~30 inherited modal tests nor NewEventTab's own tests (which stub
// this component) exercise that path, so it gets its own direct coverage
// here.
describe("BusinessEventForm — identity resync while mounted", () => {
  it("re-syncs to a newly-edited event when editingEvent changes while active", () => {
    const eventA = makeEvent({ id: "evt-a", title: "Event A" });
    const eventB = makeEvent({ id: "evt-b", title: "Event B" });
    const { rerender } = render(
      <BusinessEventForm active ownerId="u1" editingEvent={eventA} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.getByDisplayValue("Event A")).toBeInTheDocument();

    rerender(
      <BusinessEventForm active ownerId="u1" editingEvent={eventB} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.getByDisplayValue("Event B")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Event A")).not.toBeInTheDocument();
  });

  it("re-syncs from editing an event to duplicating a different one while active", () => {
    const editing = makeEvent({ id: "evt-edit", title: "Being Edited" });
    const duplicating = makeEvent({ id: "evt-dup", title: "To Duplicate" });
    const { rerender } = render(
      <BusinessEventForm active ownerId="u1" editingEvent={editing} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.getByDisplayValue("Being Edited")).toBeInTheDocument();

    rerender(
      <BusinessEventForm active ownerId="u1" editingEvent={null} duplicateFrom={duplicating} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.getByDisplayValue("To Duplicate (kopie)")).toBeInTheDocument();
  });

  it("re-syncs to a blank form when both editingEvent and duplicateFrom clear while active", () => {
    const editing = makeEvent({ id: "evt-edit", title: "Being Edited" });
    const { rerender } = render(
      <BusinessEventForm active ownerId="u1" editingEvent={editing} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.getByDisplayValue("Being Edited")).toBeInTheDocument();

    rerender(
      <BusinessEventForm active ownerId="u1" editingEvent={null} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.queryByDisplayValue("Being Edited")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Titel")).toHaveValue("");
  });

  it("does not re-sync while inactive, even if the identity changes underneath it", () => {
    const eventA = makeEvent({ id: "evt-a", title: "Event A" });
    const eventB = makeEvent({ id: "evt-b", title: "Event B" });
    const { rerender } = render(
      <BusinessEventForm active ownerId="u1" editingEvent={eventA} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.getByDisplayValue("Event A")).toBeInTheDocument();

    rerender(
      <BusinessEventForm active={false} ownerId="u1" editingEvent={eventB} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.getByDisplayValue("Event A")).toBeInTheDocument();
  });
});

describe("BusinessEventForm — preview button", () => {
  it("is not open by default", () => {
    render(
      <BusinessEventForm active ownerId="u1" editingEvent={null} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.queryByTestId("preview-modal")).not.toBeInTheDocument();
  });

  it("opens a live preview reflecting the title as currently typed, even before the form is otherwise valid", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventForm active ownerId="u1" editingEvent={null} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    await user.type(screen.getByLabelText("Titel"), "Draft Title");

    await user.click(screen.getByText("👁️ Voorbeeld bekijken"));

    const preview = screen.getByTestId("preview-modal");
    expect(preview).toHaveTextContent("title=Draft Title");
    expect(preview).toHaveTextContent("previewMode=true");
  });

  it("closes when the modal reports onClose", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventForm active ownerId="u1" editingEvent={null} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    await user.click(screen.getByText("👁️ Voorbeeld bekijken"));
    expect(screen.getByTestId("preview-modal")).toBeInTheDocument();

    await user.click(screen.getByText("stub-close"));
    expect(screen.queryByTestId("preview-modal")).not.toBeInTheDocument();
  });
});

async function fillMinimalRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Titel"), "My Event");
  await user.type(screen.getByLabelText("Beschrijving"), "Description");
  await user.type(screen.getByLabelText("Startdatum"), "2026-09-01");
  await user.click(screen.getByText("Locatie"));
  await user.type(screen.getByLabelText("Postcode"), "5038 AB");
  await user.type(screen.getByLabelText("Huisnummer"), "1");
  await user.click(screen.getByText("Zoek adres"));
  await user.type(screen.getByLabelText("Starttijd"), "10:00");
  await user.type(screen.getByLabelText("Eindtijd"), "18:00");
}

describe("BusinessEventForm — direct-to-payment redirect on create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createBusinessEvent.mockResolvedValue({ id: "new-evt-1" });
    updateBusinessEvent.mockResolvedValue(undefined);
    resolvePhotoUpdate.mockResolvedValue("");
    createCheckoutSession.mockResolvedValue("https://checkout.stripe.com/session123");
    geocodeAddress.mockResolvedValue({ lat: 51.55, lng: 5.09, formattedAddress: "Heuvelplein 1, Tilburg" });
  });

  it("shows the €10 price notice for a new event, not while editing, and not when skipPaymentRedirect is set", () => {
    const { rerender } = render(
      <BusinessEventForm active ownerId="u1" editingEvent={null} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.getByText(/kost eenmalig €10/)).toBeInTheDocument();

    rerender(
      <BusinessEventForm active ownerId="u1" editingEvent={makeEvent()} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.queryByText(/kost eenmalig €10/)).not.toBeInTheDocument();

    rerender(
      <BusinessEventForm
        active
        ownerId="u1"
        editingEvent={null}
        duplicateFrom={null}
        umbrellaEvents={[]}
        onDone={vi.fn()}
        skipPaymentRedirect
      />,
    );
    expect(screen.queryByText(/kost eenmalig €10/)).not.toBeInTheDocument();
  });

  it("creates the event, then redirects straight to the Stripe Checkout URL, without a separate toast", async () => {
    const user = userEvent.setup();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", { value: { ...originalLocation, href: "" }, writable: true, configurable: true });

    render(<BusinessEventForm active ownerId="owner-uid" editingEvent={null} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />);
    await fillMinimalRequiredFields(user);
    await user.click(screen.getByText("Opslaan"));

    expect(createBusinessEvent).toHaveBeenCalledWith("owner-uid", expect.objectContaining({ title: "My Event" }));
    expect(createCheckoutSession).toHaveBeenCalledWith("new-evt-1");
    expect(window.location.href).toBe("https://checkout.stripe.com/session123");
    expect(showToast).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("event_checkout_redirect");

    Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
  });

  it("tracks the money funnel's open and submit-attempt steps for the primary business flow", async () => {
    const user = userEvent.setup();
    render(<BusinessEventForm active ownerId="owner-uid" editingEvent={null} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />);
    expect(trackEvent).toHaveBeenCalledWith("event_form_opened");

    await fillMinimalRequiredFields(user);
    await user.click(screen.getByText("Opslaan"));
    expect(trackEvent).toHaveBeenCalledWith("event_form_submit_attempt");
  });

  it("does not track the money funnel for an admin quick-event (skipPaymentRedirect)", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventForm
        active
        ownerId="admin-uid"
        editingEvent={null}
        duplicateFrom={null}
        umbrellaEvents={[]}
        onDone={vi.fn()}
        skipPaymentRedirect
      />,
    );
    expect(trackEvent).not.toHaveBeenCalledWith("event_form_opened");
    await fillMinimalRequiredFields(user);
    await user.click(screen.getByText("Opslaan"));
    expect(trackEvent).not.toHaveBeenCalledWith("event_form_submit_attempt");
  });

  it("falls back to a toast and onDone() if starting checkout fails after the event was already saved", async () => {
    createCheckoutSession.mockRejectedValue(new Error("payment gateway down"));
    const onDone = vi.fn();
    const user = userEvent.setup();

    render(<BusinessEventForm active ownerId="owner-uid" editingEvent={null} duplicateFrom={null} umbrellaEvents={[]} onDone={onDone} />);
    await fillMinimalRequiredFields(user);
    await user.click(screen.getByText("Opslaan"));

    await vi.waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/betalen kon niet gestart worden/), "error");
  });

  it("does not call createCheckoutSession when editing an existing event", async () => {
    const user = userEvent.setup();
    const editing = makeEvent({ id: "evt-edit" });
    render(<BusinessEventForm active ownerId="owner-uid" editingEvent={editing} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />);
    await user.click(screen.getByText("Opslaan"));

    expect(updateBusinessEvent).toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("with skipPaymentRedirect, saves and calls onDone() with the old toast instead of redirecting (AdminPanel's quick-event path)", async () => {
    const onDone = vi.fn();
    const user = userEvent.setup();

    render(
      <BusinessEventForm
        active
        ownerId="admin-uid"
        editingEvent={null}
        duplicateFrom={null}
        umbrellaEvents={[]}
        onDone={onDone}
        skipPaymentRedirect
      />,
    );
    await fillMinimalRequiredFields(user);
    await user.click(screen.getByText("Opslaan"));

    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("Evenement toegevoegd. Betaal om het direct live te zetten.", "success");
    expect(onDone).toHaveBeenCalled();
  });
});

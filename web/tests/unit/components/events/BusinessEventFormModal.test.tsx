import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

const createBusinessEvent = vi.fn();
const updateBusinessEvent = vi.fn();
vi.mock("@/lib/firebase/businessEvents", () => ({
  createBusinessEvent: (...args: unknown[]) => createBusinessEvent(...args),
  updateBusinessEvent: (...args: unknown[]) => updateBusinessEvent(...args),
}));

import { BusinessEventFormModal } from "@/components/events/BusinessEventFormModal";

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
  startDate: "2026-01-01",
  endDate: "2099-01-01",
  createdAt: null as never,
};

beforeEach(() => {
  vi.clearAllMocks();
  createBusinessEvent.mockResolvedValue(undefined);
  updateBusinessEvent.mockResolvedValue(undefined);
});

async function fillMinimalRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Titel"), "My Event");
  await user.type(screen.getByLabelText("Beschrijving"), "Description");
  await user.type(screen.getByLabelText("Startdatum"), "2026-09-01");
  await user.type(screen.getByLabelText("Adres"), "Some Address 1");
  await user.type(screen.getByLabelText("Starttijd"), "10:00");
  await user.type(screen.getByLabelText("Eindtijd"), "18:00");
}

describe("BusinessEventFormModal create mode", () => {
  it("shows a validation error when required fields (incl. lat/lng) are missing", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={null}
        umbrellaEvents={[]}
      />,
    );

    await user.click(screen.getByText("Opslaan"));
    expect(screen.getByText(/Vul alle verplichte velden in/)).toBeInTheDocument();
    expect(createBusinessEvent).not.toHaveBeenCalled();
  });

  it("extracts lat/lng from a Google Maps URL and then allows saving", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal
        open
        onClose={onClose}
        ownerId="owner-uid"
        editingEvent={null}
        umbrellaEvents={[]}
      />,
    );

    await fillMinimalRequiredFields(user);
    await user.type(screen.getByLabelText("Google Maps URL"), "https://maps.google.com/@51.55,5.09,15z");
    await user.click(screen.getByText("Extract"));
    await user.click(screen.getByText("Opslaan"));

    expect(createBusinessEvent).toHaveBeenCalledWith(
      "owner-uid",
      expect.objectContaining({ lat: 51.55, lng: 5.09, title: "My Event" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error when the Maps URL has no extractable coordinates", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={null}
        umbrellaEvents={[]}
      />,
    );

    await user.type(screen.getByLabelText("Google Maps URL"), "https://example.com/not-a-maps-link");
    await user.click(screen.getByText("Extract"));

    expect(screen.getByText("Coördinaten niet gevonden")).toBeInTheDocument();
  });

  it("shows the per-day-times toggle and umbrella select only when applicable, and computes startTime/endTime from the sorted per-day range", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={null}
        umbrellaEvents={[umbrella]}
      />,
    );

    // Single-day: no per-day toggle, no umbrella select yet (date not set).
    expect(screen.queryByText("Verschillende tijden per dag")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Titel"), "Multi Day Event");
    await user.type(screen.getByLabelText("Beschrijving"), "Description");
    await user.type(screen.getByLabelText("Startdatum"), "2026-09-01");
    await user.type(screen.getByLabelText("Einddatum"), "2026-09-02");

    expect(screen.getByText("Verschillende tijden per dag")).toBeInTheDocument();
    expect(screen.getByLabelText("Onderdeel van groot evenement (optioneel)")).toBeInTheDocument();

    await user.click(screen.getByText("Verschillende tijden per dag"));
    await user.clear(screen.getByLabelText("Starttijd 2026-09-01"));
    await user.type(screen.getByLabelText("Starttijd 2026-09-01"), "09:00");
    await user.clear(screen.getByLabelText("Eindtijd 2026-09-01"));
    await user.type(screen.getByLabelText("Eindtijd 2026-09-01"), "17:00");
    await user.clear(screen.getByLabelText("Starttijd 2026-09-02"));
    await user.type(screen.getByLabelText("Starttijd 2026-09-02"), "11:00");
    await user.clear(screen.getByLabelText("Eindtijd 2026-09-02"));
    await user.type(screen.getByLabelText("Eindtijd 2026-09-02"), "20:00");
    await user.type(screen.getByLabelText("Adres"), "Some Address 1");
    await user.type(screen.getByLabelText("Google Maps URL"), "https://maps.google.com/@51.55,5.09,15z");
    await user.click(screen.getByText("Extract"));
    await user.click(screen.getByText("Opslaan"));

    expect(createBusinessEvent).toHaveBeenCalledWith(
      "owner-uid",
      expect.objectContaining({
        multiDay: true,
        startTime: "09:00", // first day's start
        endTime: "20:00", // last day's end
        dailyTimes: {
          "2026-09-01": { startTime: "09:00", endTime: "17:00" },
          "2026-09-02": { startTime: "11:00", endTime: "20:00" },
        },
      }),
    );
  });

  it("resets the per-day toggle when the range collapses back to a single day", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={null}
        umbrellaEvents={[]}
      />,
    );

    await user.type(screen.getByLabelText("Startdatum"), "2026-09-01");
    await user.type(screen.getByLabelText("Einddatum"), "2026-09-02");
    await user.click(screen.getByText("Verschillende tijden per dag"));
    // Collapse back to a single day.
    await user.clear(screen.getByLabelText("Einddatum"));
    await user.type(screen.getByLabelText("Einddatum"), "2026-09-01");

    expect(screen.queryByText("Verschillende tijden per dag")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Starttijd")).toBeInTheDocument();
  });

  it("shows a save-failure error from the underlying write", async () => {
    createBusinessEvent.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={null}
        umbrellaEvents={[]}
      />,
    );

    await fillMinimalRequiredFields(user);
    await user.type(screen.getByLabelText("Google Maps URL"), "https://maps.google.com/@51.55,5.09,15z");
    await user.click(screen.getByText("Extract"));
    await user.click(screen.getByText("Opslaan"));

    expect(await screen.findByText("Opslaan mislukt: network down")).toBeInTheDocument();
  });

  it("shows a generic error message when a non-Error is thrown while saving", async () => {
    createBusinessEvent.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={null}
        umbrellaEvents={[]}
      />,
    );

    await fillMinimalRequiredFields(user);
    await user.type(screen.getByLabelText("Google Maps URL"), "https://maps.google.com/@51.55,5.09,15z");
    await user.click(screen.getByText("Extract"));
    await user.click(screen.getByText("Opslaan"));

    expect(await screen.findByText("Opslaan mislukt.")).toBeInTheDocument();
  });

  it("changes the category and includes it on save", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={null}
        umbrellaEvents={[]}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Categorie"), "muziek");
    await fillMinimalRequiredFields(user);
    await user.type(screen.getByLabelText("Google Maps URL"), "https://maps.google.com/@51.55,5.09,15z");
    await user.click(screen.getByText("Extract"));
    await user.click(screen.getByText("Opslaan"));

    expect(createBusinessEvent).toHaveBeenCalledWith(
      "owner-uid",
      expect.objectContaining({ category: "muziek" }),
    );
  });

  it("selects an umbrella event and includes it on save", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={null}
        umbrellaEvents={[umbrella]}
      />,
    );

    await fillMinimalRequiredFields(user);
    await user.selectOptions(screen.getByLabelText("Onderdeel van groot evenement (optioneel)"), "u1");
    await user.type(screen.getByLabelText("Google Maps URL"), "https://maps.google.com/@51.55,5.09,15z");
    await user.click(screen.getByText("Extract"));
    await user.click(screen.getByText("Opslaan"));

    expect(createBusinessEvent).toHaveBeenCalledWith(
      "owner-uid",
      expect.objectContaining({ umbrellaEventId: "u1" }),
    );
  });

  it("calls onClose when cancelled", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal
        open
        onClose={onClose}
        ownerId="owner-uid"
        editingEvent={null}
        umbrellaEvents={[]}
      />,
    );

    await user.click(screen.getByText("Annuleren"));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("BusinessEventFormModal edit mode", () => {
  it("pre-fills the form from the editing event", () => {
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={makeEvent()}
        umbrellaEvents={[]}
      />,
    );

    expect(screen.getByDisplayValue("Test Event")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A test event")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Evenement bewerken" })).toBeInTheDocument();
  });

  it("pulls an approved event back to pending on a significant change (title)", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    const approvedEvent = makeEvent({ status: "approved" });
    render(
      <BusinessEventFormModal
        open
        onClose={onClose}
        ownerId="owner-uid"
        editingEvent={approvedEvent}
        umbrellaEvents={[]}
      />,
    );

    const titleInput = screen.getByLabelText("Titel");
    await user.clear(titleInput);
    await user.type(titleInput, "Changed Title");
    await user.click(screen.getByText("Opslaan"));

    expect(updateBusinessEvent).toHaveBeenCalledWith(
      "evt1",
      expect.objectContaining({ title: "Changed Title" }),
      { pullBackToPending: true },
    );
  });

  it("does not pull back to pending when nothing significant changed", async () => {
    const user = userEvent.setup();
    const approvedEvent = makeEvent({ status: "approved" });
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={approvedEvent}
        umbrellaEvents={[]}
      />,
    );

    await user.click(screen.getByText("Opslaan"));

    expect(updateBusinessEvent).toHaveBeenCalledWith("evt1", expect.anything(), { pullBackToPending: false });
  });
});

describe("BusinessEventFormModal duplicate mode", () => {
  it("pre-fills with a '(kopie)' title suffix and creates a new event on save", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={null}
        duplicateFrom={makeEvent()}
        umbrellaEvents={[]}
      />,
    );

    expect(screen.getByDisplayValue("Test Event (kopie)")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Nieuw evenement" })).toBeInTheDocument();

    await user.click(screen.getByText("Opslaan"));
    expect(createBusinessEvent).toHaveBeenCalledWith(
      "owner-uid",
      expect.objectContaining({ title: "Test Event (kopie)" }),
    );
  });
});

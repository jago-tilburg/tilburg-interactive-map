import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import type { PendingPhoto } from "@/components/common/PhotoUploadField";

const createBusinessEvent = vi.fn();
const updateBusinessEvent = vi.fn();
vi.mock("@/lib/firebase/businessEvents", () => ({
  createBusinessEvent: (...args: unknown[]) => createBusinessEvent(...args),
  updateBusinessEvent: (...args: unknown[]) => updateBusinessEvent(...args),
}));

const resolvePhotoUpdate = vi.fn();
vi.mock("@/lib/photos/resolvePhotoUpdate", () => ({
  resolvePhotoUpdate: (...a: unknown[]) => resolvePhotoUpdate(...a),
}));

const showToast = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast }),
}));

// See ShopFormModal.test.tsx for why PhotoUploadField is faked down to just
// its two triggering buttons here — its own pipeline is covered by its
// dedicated test file.
vi.mock("@/components/common/PhotoUploadField", () => ({
  PhotoUploadField: ({
    onPendingPhotoChange,
  }: {
    onPendingPhotoChange: (p: PendingPhoto | null) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onPendingPhotoChange({ action: "replace", blob: new Blob(["x"]), previewUrl: "blob:preview" })}
      >
        FakeSelectPhoto
      </button>
      <button type="button" onClick={() => onPendingPhotoChange({ action: "remove" })}>
        FakeRemovePhoto
      </button>
    </div>
  ),
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
    city: "Tilburg",
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
  city: "Tilburg",
  createdAt: null as never,
};

// Stubs window.google.maps.Geocoder the same way tests/unit/lib/maps/
// geocodeAddress.test.ts and reverseGeocode.test.ts do — geocodeAddress()
// (called by the Locatie row's "Zoek adres" button) needs this real global,
// not a mock of the helper itself, since that's what actually proves the
// wiring works end to end. Defaults to a successful lookup; individual
// tests override `geocode.mockImplementation` for the failure case.
const geocode = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  createBusinessEvent.mockResolvedValue({ id: "evt1" });
  updateBusinessEvent.mockResolvedValue(undefined);
  resolvePhotoUpdate.mockResolvedValue("");
  geocode.mockReset();
  geocode.mockImplementation((_req, cb) => {
    cb(
      [{ formatted_address: "Heuvelplein 1, Tilburg", geometry: { location: { lat: () => 51.55, lng: () => 5.09 } } }],
      "OK",
    );
  });
  window.google = {
    maps: {
      Geocoder: function Geocoder(this: { geocode: typeof geocode }) {
        this.geocode = geocode;
      },
    },
  } as never;
});

// Opens the Locatie row, looks up an address via the (mocked) Geocoder, and
// fills the other three required fields — the one sequence nearly every
// "successful save" test needs before clicking Opslaan.
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

describe("BusinessEventFormModal create mode", () => {
  it("marks title, description, start date, and address as required and blocks submission when empty", async () => {
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

    expect(screen.getByLabelText("Titel")).toBeRequired();
    expect(screen.getByLabelText("Beschrijving")).toBeRequired();
    expect(screen.getByLabelText("Startdatum")).toBeRequired();

    await user.click(screen.getByText("Locatie"));
    expect(screen.getByLabelText("Adres")).toBeRequired();

    await user.click(screen.getByText("Opslaan"));
    expect(createBusinessEvent).not.toHaveBeenCalled();
  });

  it("geocodes a postcode + huisnummer to an address and coordinates, then allows saving", async () => {
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
    await user.click(screen.getByText("Website"));
    await user.type(screen.getByLabelText("Website-URL"), "https://example.com");
    await user.click(screen.getByText("Opslaan"));

    expect(createBusinessEvent).toHaveBeenCalledWith(
      "owner-uid",
      expect.objectContaining({
        lat: 51.55,
        lng: 5.09,
        title: "My Event",
        websiteUrl: "https://example.com",
        prices: [],
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("uploads the photo after create and attaches its URL, once the new event's id is known", async () => {
    resolvePhotoUpdate.mockResolvedValue("https://storage.example/businessEvents/evt1/abc.webp");
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal open onClose={onClose} ownerId="owner-uid" editingEvent={null} umbrellaEvents={[]} />,
    );

    await fillMinimalRequiredFields(user);
    await user.click(screen.getByText("Foto"));
    await user.click(screen.getByText("FakeSelectPhoto"));
    await user.click(screen.getByText("Opslaan"));

    expect(createBusinessEvent).toHaveBeenCalledWith("owner-uid", expect.objectContaining({ photoUrl: "" }));
    expect(resolvePhotoUpdate).toHaveBeenCalledWith(
      "businessEvents",
      "evt1",
      expect.objectContaining({ action: "replace" }),
      "",
    );
    expect(updateBusinessEvent).toHaveBeenCalledWith(
      "evt1",
      expect.objectContaining({ photoUrl: "https://storage.example/businessEvents/evt1/abc.webp" }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("skips the extra photoUrl write when the resolved photo is empty (picked then removed before ever saving)", async () => {
    resolvePhotoUpdate.mockResolvedValue("");
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal open onClose={vi.fn()} ownerId="owner-uid" editingEvent={null} umbrellaEvents={[]} />,
    );

    await fillMinimalRequiredFields(user);
    await user.click(screen.getByText("Foto"));
    await user.click(screen.getByText("FakeRemovePhoto"));
    await user.click(screen.getByText("Opslaan"));

    expect(updateBusinessEvent).not.toHaveBeenCalled();
  });

  it("shows a toast and still closes when the photo upload fails after a successful create (record is already saved)", async () => {
    resolvePhotoUpdate.mockRejectedValue(new Error("upload failed"));
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal open onClose={onClose} ownerId="owner-uid" editingEvent={null} umbrellaEvents={[]} />,
    );

    await fillMinimalRequiredFields(user);
    await user.click(screen.getByText("Foto"));
    await user.click(screen.getByText("FakeSelectPhoto"));
    await user.click(screen.getByText("Opslaan"));

    expect(updateBusinessEvent).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      "Evenement opgeslagen, maar foto uploaden is mislukt. Voeg de foto later toe via bewerken.",
      "error",
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("adds, edits, toggles Gratis on, toggles Gratis off, and removes a price row", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal open onClose={vi.fn()} ownerId="owner-uid" editingEvent={null} umbrellaEvents={[]} />,
    );

    await user.click(screen.getByText("Toegangsprijzen"));
    await user.click(screen.getByText("+ Voeg toegangsprijs toe"));
    await user.type(screen.getByLabelText("Prijslabel 1"), "Vroegboekticket");
    await user.type(screen.getByLabelText("Prijsbedrag 1"), "12.5");
    expect(screen.getByLabelText("Prijsbedrag 1")).toHaveValue(12.5);

    await user.click(screen.getByLabelText("Gratis 1"));
    expect(screen.getByLabelText("Prijsbedrag 1")).toHaveValue(0);

    await user.click(screen.getByLabelText("Gratis 1"));
    expect(screen.getByLabelText("Prijsbedrag 1")).toHaveValue(0);

    await user.click(screen.getByText("Verwijderen"));
    expect(screen.queryByLabelText("Prijslabel 1")).not.toBeInTheDocument();
  });

  it("updates only the targeted price row when multiple rows exist", async () => {
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal open onClose={vi.fn()} ownerId="owner-uid" editingEvent={null} umbrellaEvents={[]} />,
    );

    await user.click(screen.getByText("Toegangsprijzen"));
    await user.click(screen.getByText("+ Voeg toegangsprijs toe"));
    await user.click(screen.getByText("+ Voeg toegangsprijs toe"));
    await user.type(screen.getByLabelText("Prijslabel 1"), "Vroegboekticket");
    await user.type(screen.getByLabelText("Prijslabel 2"), "VIP");

    expect(screen.getByLabelText("Prijslabel 1")).toHaveValue("Vroegboekticket");
    expect(screen.getByLabelText("Prijslabel 2")).toHaveValue("VIP");
  });

  it("filters out price rows with an empty label on save", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal open onClose={onClose} ownerId="owner-uid" editingEvent={null} umbrellaEvents={[]} />,
    );

    await fillMinimalRequiredFields(user);
    await user.click(screen.getByText("Toegangsprijzen"));
    await user.click(screen.getByText("+ Voeg toegangsprijs toe"));
    await user.click(screen.getByText("Opslaan"));

    expect(createBusinessEvent).toHaveBeenCalledWith("owner-uid", expect.objectContaining({ prices: [] }));
  });

  it("shows an error when the postcode + huisnummer can't be geocoded", async () => {
    geocode.mockImplementation((_req, cb) => {
      cb(null, "ZERO_RESULTS");
    });
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

    await user.click(screen.getByText("Locatie"));
    await user.type(screen.getByLabelText("Postcode"), "0000 ZZ");
    await user.type(screen.getByLabelText("Huisnummer"), "1");
    await user.click(screen.getByText("Zoek adres"));

    expect(screen.getByText("Adres niet gevonden")).toBeInTheDocument();
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
    await user.click(screen.getByText("Locatie"));
    await user.type(screen.getByLabelText("Postcode"), "5038 AB");
    await user.type(screen.getByLabelText("Huisnummer"), "1");
    await user.click(screen.getByText("Zoek adres"));
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

  it("blocks a significant change (title) to a PAID event client-side, with a clear error, and never calls updateBusinessEvent", async () => {
    const user = userEvent.setup();
    const paidEvent = makeEvent({ status: "approved", paid: true });
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={paidEvent}
        umbrellaEvents={[]}
      />,
    );

    const titleInput = screen.getByLabelText("Titel");
    await user.clear(titleInput);
    await user.type(titleInput, "Changed Title");
    await user.click(screen.getByText("Opslaan"));

    expect(
      screen.getByText("Titel, datum of locatie van een betaald, live evenement kun je niet meer wijzigen."),
    ).toBeInTheDocument();
    expect(updateBusinessEvent).not.toHaveBeenCalled();
  });

  it("still allows a non-significant change (description) to a PAID event", async () => {
    const user = userEvent.setup();
    const paidEvent = makeEvent({ status: "approved", paid: true });
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={paidEvent}
        umbrellaEvents={[]}
      />,
    );

    const descriptionInput = screen.getByLabelText("Beschrijving");
    await user.clear(descriptionInput);
    await user.type(descriptionInput, "Updated description");
    await user.click(screen.getByText("Opslaan"));

    expect(updateBusinessEvent).toHaveBeenCalledWith(
      "evt1",
      expect.objectContaining({ description: "Updated description" }),
    );
  });

  it("allows a significant change on an unpaid (pending) event", async () => {
    const user = userEvent.setup();
    const pendingEvent = makeEvent({ status: "pending", paid: false });
    render(
      <BusinessEventFormModal
        open
        onClose={vi.fn()}
        ownerId="owner-uid"
        editingEvent={pendingEvent}
        umbrellaEvents={[]}
      />,
    );

    const titleInput = screen.getByLabelText("Titel");
    await user.clear(titleInput);
    await user.type(titleInput, "Changed Title");
    await user.click(screen.getByText("Opslaan"));

    expect(updateBusinessEvent).toHaveBeenCalledWith("evt1", expect.objectContaining({ title: "Changed Title" }));
  });

  it("replaces the photo on save, resolving the new URL via the event's existing id", async () => {
    const event = makeEvent({ photoUrl: "https://storage.example/businessEvents/evt1/old.webp" });
    resolvePhotoUpdate.mockResolvedValue("https://storage.example/businessEvents/evt1/new.webp");
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal open onClose={vi.fn()} ownerId="owner-uid" editingEvent={event} umbrellaEvents={[]} />,
    );

    await user.click(screen.getByText("Foto"));
    await user.click(screen.getByText("FakeSelectPhoto"));
    await user.click(screen.getByText("Opslaan"));

    expect(resolvePhotoUpdate).toHaveBeenCalledWith(
      "businessEvents",
      "evt1",
      expect.objectContaining({ action: "replace" }),
      "https://storage.example/businessEvents/evt1/old.webp",
    );
    expect(updateBusinessEvent).toHaveBeenCalledWith(
      "evt1",
      expect.objectContaining({ photoUrl: "https://storage.example/businessEvents/evt1/new.webp" }),
    );
  });

  it("removes the photo on save, setting photoUrl to empty", async () => {
    const event = makeEvent({ photoUrl: "https://storage.example/businessEvents/evt1/old.webp" });
    resolvePhotoUpdate.mockResolvedValue("");
    const user = userEvent.setup();
    render(
      <BusinessEventFormModal open onClose={vi.fn()} ownerId="owner-uid" editingEvent={event} umbrellaEvents={[]} />,
    );

    await user.click(screen.getByText("Foto"));
    await user.click(screen.getByText("FakeRemovePhoto"));
    await user.click(screen.getByText("Opslaan"));

    expect(resolvePhotoUpdate).toHaveBeenCalledWith(
      "businessEvents",
      "evt1",
      expect.objectContaining({ action: "remove" }),
      "https://storage.example/businessEvents/evt1/old.webp",
    );
    expect(updateBusinessEvent).toHaveBeenCalledWith("evt1", expect.objectContaining({ photoUrl: "" }));
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

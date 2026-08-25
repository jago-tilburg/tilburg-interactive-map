import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BusinessEvent } from "@/types/events";

const deleteCurrentUser = vi.fn();
const changeBusinessPassword = vi.fn();
vi.mock("@/lib/firebase/auth", () => ({
  signOutCurrentUser: vi.fn(),
  deleteCurrentUser: (...a: unknown[]) => deleteCurrentUser(...a),
  changeBusinessPassword: (...a: unknown[]) => changeBusinessPassword(...a),
}));

const mockUseAuth = vi.fn();
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

const showToast = vi.fn();
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast }),
}));

let emittedEvents: BusinessEvent[] = [];
const subscribeMyBusinessEvents = vi.fn(
  (_uid: string, onChange: (events: BusinessEvent[]) => void, ..._rest: [((err: Error) => void)?]) => {
    onChange(emittedEvents);
    return vi.fn();
  },
);
const deleteBusinessEvent = vi.fn();
vi.mock("@/lib/firebase/businessEvents", () => ({
  subscribeMyBusinessEvents: (
    ...args: [string, (events: BusinessEvent[]) => void, ((err: Error) => void)?]
  ) => subscribeMyBusinessEvents(...args),
  deleteBusinessEvent: (...args: [string]) => deleteBusinessEvent(...args),
  trackEventView: vi.fn().mockResolvedValue(undefined),
  incrementEventInterest: vi.fn().mockResolvedValue(undefined),
  incrementEventClicks: vi.fn().mockResolvedValue(undefined),
}));

const deleteBusinessAccountCascade = vi.fn();
const updateBusinessProfile = vi.fn();
vi.mock("@/lib/firebase/firestore", () => ({
  setEventSaved: vi.fn().mockResolvedValue(undefined),
  deleteBusinessAccountCascade: (...a: unknown[]) => deleteBusinessAccountCascade(...a),
  updateBusinessProfile: (...a: unknown[]) => updateBusinessProfile(...a),
}));

vi.mock("@/lib/firebase/umbrellaEvents", () => ({
  subscribeUmbrellaEvents: vi.fn(() => vi.fn()),
  createUmbrellaEvent: vi.fn(),
  updateUmbrellaEvent: vi.fn(),
}));

const confirmEventPaymentStub = vi.fn();
vi.mock("@/lib/firebase/functions", () => ({
  confirmEventPaymentStub: (...args: [string]) => confirmEventPaymentStub(...args),
}));

import { BusinessDashboard } from "@/components/auth/BusinessDashboard";
import { signOutCurrentUser } from "@/lib/firebase/auth";

const business = { uid: "u1", businessName: "My Shop", email: "biz@example.com", createdAt: null };

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
    status: "pending",
    paid: false,
    createdAt: null as never,
    ...overrides,
  };
}

const refreshCurrentBusiness = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  emittedEvents = [];
  confirmEventPaymentStub.mockResolvedValue(undefined);
  deleteBusinessEvent.mockResolvedValue(undefined);
  deleteBusinessAccountCascade.mockResolvedValue(undefined);
  deleteCurrentUser.mockResolvedValue(undefined);
  updateBusinessProfile.mockResolvedValue(undefined);
  changeBusinessPassword.mockResolvedValue(undefined);
  refreshCurrentBusiness.mockResolvedValue(undefined);
});

describe("BusinessDashboard", () => {
  it("renders nothing when there is no current business", () => {
    mockUseAuth.mockReturnValue({ currentBusiness: null });
    const { container } = render(<BusinessDashboard open onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the business name/email and signs out on logout", async () => {
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    vi.mocked(signOutCurrentUser).mockResolvedValue(undefined as never);
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "My Shop" })).toBeInTheDocument();
    expect(screen.getByText("biz@example.com")).toBeInTheDocument();
    await user.click(screen.getByText("Uitloggen"));
    expect(signOutCurrentUser).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the empty state when there are no events", () => {
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    render(<BusinessDashboard open onClose={vi.fn()} />);
    expect(screen.getByText(/Nog geen evenementen/)).toBeInTheDocument();
  });

  it("lists events with status and schedule, and opens the create form", async () => {
    emittedEvents = [makeEvent()];
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    expect(screen.getByText(/Test Event/)).toBeInTheDocument();
    expect(screen.getByText("In afwachting")).toBeInTheDocument();

    await user.click(screen.getByText("+ Nieuw evenement"));
    expect(screen.getByRole("dialog", { name: "Nieuw evenement" })).toBeInTheDocument();
  });

  it("opens the edit form pre-filled for an existing event", async () => {
    emittedEvents = [makeEvent()];
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText("Bewerken"));
    expect(screen.getByRole("dialog", { name: "Evenement bewerken" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test Event")).toBeInTheDocument();
  });

  it("opens the duplicate form pre-filled with a '(kopie)' suffix", async () => {
    emittedEvents = [makeEvent()];
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText("Dupliceren"));
    expect(screen.getByRole("dialog", { name: "Nieuw evenement" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test Event (kopie)")).toBeInTheDocument();
  });

  it("deletes an event", async () => {
    emittedEvents = [makeEvent()];
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText("Verwijderen"));
    expect(deleteBusinessEvent).toHaveBeenCalledWith("evt1");
  });

  it("shows the mock-pay button only for a pending, unpaid event, and calls the stub function", async () => {
    emittedEvents = [makeEvent({ status: "pending", paid: false })];
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText("Nu betalen (mock)"));
    expect(confirmEventPaymentStub).toHaveBeenCalledWith("evt1");
  });

  it("shows a paid label instead of the pay button once paid", () => {
    emittedEvents = [makeEvent({ status: "approved", paid: true })];
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    render(<BusinessDashboard open onClose={vi.fn()} />);

    expect(screen.getByText(/Betaald, live op de kaart/)).toBeInTheDocument();
    expect(screen.queryByText("Nu betalen (mock)")).not.toBeInTheDocument();
  });

  it("opens the event detail modal when the title is clicked", async () => {
    emittedEvents = [makeEvent()];
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText(/🍔 Test Event/));
    expect(screen.getByRole("dialog", { name: "🍔 Test Event" })).toBeInTheDocument();
  });

  it("shows an error message when deleting fails", async () => {
    emittedEvents = [makeEvent()];
    deleteBusinessEvent.mockRejectedValue(new Error("network down"));
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic error message when a non-Error is thrown while deleting", async () => {
    emittedEvents = [makeEvent()];
    deleteBusinessEvent.mockRejectedValue("not an Error instance");
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("Verwijderen mislukt.")).toBeInTheDocument();
  });

  it("shows an error message when the mock payment call fails", async () => {
    emittedEvents = [makeEvent({ status: "pending", paid: false })];
    confirmEventPaymentStub.mockRejectedValue(new Error("payment gateway down"));
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText("Nu betalen (mock)"));
    expect(await screen.findByText("payment gateway down")).toBeInTheDocument();
  });

  it("shows a generic error message when a non-Error is thrown while paying", async () => {
    emittedEvents = [makeEvent({ status: "pending", paid: false })];
    confirmEventPaymentStub.mockRejectedValue("not an Error instance");
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText("Nu betalen (mock)"));
    expect(await screen.findByText("Betalen mislukt.")).toBeInTheDocument();
  });

  it("closes the create/edit form and the detail modal", async () => {
    emittedEvents = [makeEvent()];
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText("+ Nieuw evenement"));
    await user.click(screen.getByText("Annuleren"));
    expect(screen.queryByRole("dialog", { name: "Nieuw evenement" })).not.toBeInTheDocument();

    await user.click(screen.getByText(/🍔 Test Event/));
    expect(screen.getByRole("dialog", { name: "🍔 Test Event" })).toBeInTheDocument();
    await user.click(screen.getByLabelText("Sluiten"));
    expect(screen.queryByRole("dialog", { name: "🍔 Test Event" })).not.toBeInTheDocument();
  });

  it("surfaces a subscription error from subscribeMyBusinessEvents", () => {
    subscribeMyBusinessEvents.mockImplementation(
      (_uid: string, _onChange: (events: BusinessEvent[]) => void, onError?: (err: Error) => void) => {
        onError?.(new Error("listener failed"));
        return vi.fn();
      },
    );
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    render(<BusinessDashboard open onClose={vi.fn()} />);

    expect(screen.getByText("listener failed")).toBeInTheDocument();
  });

  it("shows KPI totals across events and per-event view/click/interest stats", () => {
    // "Live" requires both approved AND paid — an approved-but-unpaid event
    // isn't actually visible on the map yet, so evt1 must be paid to count.
    const eventsToEmit = [
      makeEvent({ id: "evt1", status: "approved", paid: true, views: 10, clicks: 3, interest: 2 }),
      makeEvent({ id: "evt2", status: "pending", views: 5, clicks: 1, interest: 0 }),
    ];
    subscribeMyBusinessEvents.mockImplementation(
      (_uid: string, onChange: (events: BusinessEvent[]) => void) => {
        onChange(eventsToEmit);
        return vi.fn();
      },
    );
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    render(<BusinessDashboard open onClose={vi.fn()} />);

    expect(screen.getByText("1")).toBeInTheDocument(); // Live events
    expect(screen.getByText("15")).toBeInTheDocument(); // Views totaal
    expect(screen.getByText("4")).toBeInTheDocument(); // Klikken totaal
    expect(screen.getByText("👁️ 10 · 🔗 3 · ❤️ 2")).toBeInTheDocument();
    expect(screen.getByText("👁️ 5 · 🔗 1 · ❤️ 0")).toBeInTheDocument();
  });

  it("filters the event list via the filter chips, matching each chip's own count", async () => {
    const user = userEvent.setup();
    emittedEvents = [
      makeEvent({ id: "evt1", title: "Live One", status: "approved", paid: true }),
      makeEvent({ id: "evt2", title: "Pending One", status: "pending" }),
      makeEvent({ id: "evt3", title: "Rejected One", status: "rejected" }),
    ];
    subscribeMyBusinessEvents.mockImplementation(
      (_uid: string, onChange: (events: BusinessEvent[]) => void) => {
        onChange(emittedEvents);
        return vi.fn();
      },
    );
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    render(<BusinessDashboard open onClose={vi.fn()} />);

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
  });

  it("shows the rejection reason on a rejected event, when the admin gave one", () => {
    emittedEvents = [
      makeEvent({ id: "evt1", status: "rejected", rejectionReason: "Adres onvindbaar" }),
      makeEvent({ id: "evt2", status: "rejected" }),
    ];
    subscribeMyBusinessEvents.mockImplementation(
      (_uid: string, onChange: (events: BusinessEvent[]) => void) => {
        onChange(emittedEvents);
        return vi.fn();
      },
    );
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    render(<BusinessDashboard open onClose={vi.fn()} />);

    expect(screen.getByText("Reden voor afwijzing: Adres onvindbaar")).toBeInTheDocument();
    expect(screen.queryAllByText(/^Reden voor afwijzing:/)).toHaveLength(1);
  });

  it("sorts events newest-first by createdAt", () => {
    const older = { toMillis: () => 1000 } as unknown as BusinessEvent["createdAt"];
    const newer = { toMillis: () => 2000 } as unknown as BusinessEvent["createdAt"];
    emittedEvents = [
      makeEvent({ id: "evt-old", title: "Older Event", createdAt: older }),
      makeEvent({ id: "evt-new", title: "Newer Event", createdAt: newer }),
    ];
    subscribeMyBusinessEvents.mockImplementation(
      (_uid: string, onChange: (events: BusinessEvent[]) => void) => {
        onChange(emittedEvents);
        return vi.fn();
      },
    );
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    render(<BusinessDashboard open onClose={vi.fn()} />);

    const titles = screen.getAllByText(/Older Event|Newer Event/).map((el) => el.textContent);
    expect(titles.join("|")).toMatch(/Newer Event[\s\S]*Older Event/);
  });

  it("shows zeroed KPIs and stats when an event has no counters yet", () => {
    subscribeMyBusinessEvents.mockImplementation(
      (_uid: string, onChange: (events: BusinessEvent[]) => void) => {
        onChange([makeEvent({ id: "evt1", status: "pending" })]);
        return vi.fn();
      },
    );
    mockUseAuth.mockReturnValue({ currentBusiness: business });
    render(<BusinessDashboard open onClose={vi.fn()} />);

    expect(screen.getByText("👁️ 0 · 🔗 0 · ❤️ 0")).toBeInTheDocument();
  });

  it("no-ops when there is no current auth user", async () => {
    mockUseAuth.mockReturnValue({ currentUser: null, currentBusiness: business });
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText("Account verwijderen"));

    expect(deleteBusinessAccountCascade).not.toHaveBeenCalled();
  });

  it("deletes the business account cascade and the auth user, then closes", async () => {
    mockUseAuth.mockReturnValue({ currentUser: { uid: "u1" }, currentBusiness: business });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={onClose} />);

    await user.click(screen.getByText("Account verwijderen"));

    expect(deleteBusinessAccountCascade).toHaveBeenCalledWith("u1");
    expect(deleteCurrentUser).toHaveBeenCalledWith({ uid: "u1" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error when deleting the business account fails", async () => {
    mockUseAuth.mockReturnValue({ currentUser: { uid: "u1" }, currentBusiness: business });
    deleteBusinessAccountCascade.mockRejectedValue(new Error("requires recent login"));
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText("Account verwijderen"));

    expect(await screen.findByText("requires recent login")).toBeInTheDocument();
  });

  it("shows a generic error when business account deletion fails with a non-Error", async () => {
    mockUseAuth.mockReturnValue({ currentUser: { uid: "u1" }, currentBusiness: business });
    deleteBusinessAccountCascade.mockRejectedValue("nope");
    const user = userEvent.setup();
    render(<BusinessDashboard open onClose={vi.fn()} />);

    await user.click(screen.getByText("Account verwijderen"));

    expect(await screen.findByText("Account verwijderen mislukt.")).toBeInTheDocument();
  });

  describe("Settings tab", () => {
    function setupSettings() {
      mockUseAuth.mockReturnValue({
        currentUser: { uid: "u1", email: "biz@example.com" },
        currentBusiness: business,
        refreshCurrentBusiness,
      });
      const user = userEvent.setup();
      render(<BusinessDashboard open onClose={vi.fn()} />);
      return user;
    }

    it("switches to the Settings tab, pre-filled from the current profile", async () => {
      const user = await setupSettings();
      await user.click(screen.getByText("Instellingen"));

      expect(screen.getByDisplayValue("My Shop")).toBeInTheDocument();
      expect(screen.getByDisplayValue("biz@example.com")).toBeInTheDocument();
      expect(screen.getByLabelText("E-mail")).toBeDisabled();
    });

    it("rejects an empty business name without saving", async () => {
      const user = await setupSettings();
      await user.click(screen.getByText("Instellingen"));

      await user.clear(screen.getByLabelText("Bedrijfsnaam"));
      await user.click(screen.getByText("Instellingen opslaan"));

      expect(await screen.findByText("Bedrijfsnaam mag niet leeg zijn")).toBeInTheDocument();
      expect(updateBusinessProfile).not.toHaveBeenCalled();
    });

    it("saves the business name and default address, then refreshes the profile", async () => {
      const user = await setupSettings();
      await user.click(screen.getByText("Instellingen"));

      await user.clear(screen.getByLabelText("Bedrijfsnaam"));
      await user.type(screen.getByLabelText("Bedrijfsnaam"), "Renamed Shop");
      await user.type(screen.getByLabelText("Standaardadres"), "Heuvelstraat 1");
      await user.click(screen.getByText("Instellingen opslaan"));

      await waitFor(() =>
        expect(updateBusinessProfile).toHaveBeenCalledWith(
          "u1",
          expect.objectContaining({ businessName: "Renamed Shop", defaultAddress: "Heuvelstraat 1" }),
        ),
      );
      expect(changeBusinessPassword).not.toHaveBeenCalled();
      expect(refreshCurrentBusiness).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith("Instellingen opgeslagen", "success");
    });

    it("changes the password when a new one is entered", async () => {
      const user = await setupSettings();
      await user.click(screen.getByText("Instellingen"));

      await user.type(screen.getByLabelText("Huidig wachtwoord"), "oldpw123");
      await user.type(screen.getByLabelText("Nieuw wachtwoord"), "newpw123");
      await user.click(screen.getByText("Instellingen opslaan"));

      await waitFor(() =>
        expect(changeBusinessPassword).toHaveBeenCalledWith(
          { uid: "u1", email: "biz@example.com" },
          "oldpw123",
          "newpw123",
        ),
      );
    });

    it("shows an error and does not refresh when saving fails", async () => {
      updateBusinessProfile.mockRejectedValue(new Error("offline"));
      const user = await setupSettings();
      await user.click(screen.getByText("Instellingen"));
      await user.click(screen.getByText("Instellingen opslaan"));

      expect(await screen.findByText("offline")).toBeInTheDocument();
      expect(refreshCurrentBusiness).not.toHaveBeenCalled();
    });

    it("extracts lat/lng from a pasted Google Maps URL", async () => {
      const user = await setupSettings();
      await user.click(screen.getByText("Instellingen"));

      await user.type(
        screen.getByPlaceholderText("Google Maps URL"),
        "https://www.google.com/maps/@51.5555,5.0913,17z",
      );
      await user.click(screen.getByText("Extract"));
      await user.click(screen.getByText("Instellingen opslaan"));

      await waitFor(() =>
        expect(updateBusinessProfile).toHaveBeenCalledWith(
          "u1",
          expect.objectContaining({ defaultLat: 51.5555, defaultLng: 5.0913 }),
        ),
      );
    });

    it("shows an error when the Maps URL has no extractable coordinates", async () => {
      const user = await setupSettings();
      await user.click(screen.getByText("Instellingen"));

      await user.type(screen.getByPlaceholderText("Google Maps URL"), "not a maps url");
      await user.click(screen.getByText("Extract"));

      expect(await screen.findByText("Coördinaten niet gevonden")).toBeInTheDocument();
      expect(updateBusinessProfile).not.toHaveBeenCalled();
    });
  });
});

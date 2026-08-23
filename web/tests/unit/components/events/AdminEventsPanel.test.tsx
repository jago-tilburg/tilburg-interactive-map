import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

let emittedEvents: BusinessEvent[] = [];
let emittedUmbrellas: UmbrellaEvent[] = [];
const subscribeAllBusinessEventsForAdmin = vi.fn(
  (onChange: (events: BusinessEvent[]) => void, ..._rest: [((err: Error) => void)?]) => {
    onChange(emittedEvents);
    return vi.fn();
  },
);
vi.mock("@/lib/firebase/businessEvents", () => ({
  subscribeAllBusinessEventsForAdmin: (
    ...args: [(events: BusinessEvent[]) => void, ((err: Error) => void)?]
  ) => subscribeAllBusinessEventsForAdmin(...args),
}));

const deleteUmbrellaEvent = vi.fn();
const subscribeUmbrellaEvents = vi.fn(
  (onChange: (umbrellas: UmbrellaEvent[]) => void, ..._rest: [((err: Error) => void)?]) => {
    onChange(emittedUmbrellas);
    return vi.fn();
  },
);
vi.mock("@/lib/firebase/umbrellaEvents", () => ({
  subscribeUmbrellaEvents: (
    ...args: [(umbrellas: UmbrellaEvent[]) => void, ((err: Error) => void)?]
  ) => subscribeUmbrellaEvents(...args),
  deleteUmbrellaEvent: (...args: [string]) => deleteUmbrellaEvent(...args),
  createUmbrellaEvent: vi.fn(),
  updateUmbrellaEvent: vi.fn(),
}));

const approveEvent = vi.fn();
const rejectEvent = vi.fn();
vi.mock("@/lib/firebase/functions", () => ({
  approveEvent: (...args: [string]) => approveEvent(...args),
  rejectEvent: (...args: [string]) => rejectEvent(...args),
}));

import { AdminEventsPanel } from "@/components/events/AdminEventsPanel";

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
  emittedEvents = [];
  emittedUmbrellas = [];
  approveEvent.mockResolvedValue(undefined);
  rejectEvent.mockResolvedValue(undefined);
  deleteUmbrellaEvent.mockResolvedValue(undefined);
});

describe("AdminEventsPanel subscription errors", () => {
  it("surfaces an error from the businessEvents subscription", () => {
    subscribeAllBusinessEventsForAdmin.mockImplementationOnce(
      (_onChange: (events: BusinessEvent[]) => void, onError?: (err: Error) => void) => {
        onError?.(new Error("businessEvents listener failed"));
        return vi.fn();
      },
    );
    render(<AdminEventsPanel open onClose={vi.fn()} />);
    expect(screen.getByText("businessEvents listener failed")).toBeInTheDocument();
  });

  it("surfaces an error from the umbrellaEvents subscription", () => {
    subscribeUmbrellaEvents.mockImplementationOnce(
      (_onChange: (umbrellas: UmbrellaEvent[]) => void, onError?: (err: Error) => void) => {
        onError?.(new Error("umbrellaEvents listener failed"));
        return vi.fn();
      },
    );
    render(<AdminEventsPanel open onClose={vi.fn()} />);
    expect(screen.getByText("umbrellaEvents listener failed")).toBeInTheDocument();
  });
});

describe("AdminEventsPanel businessEvents tab", () => {
  it("shows the empty state when there are no events", () => {
    render(<AdminEventsPanel open onClose={vi.fn()} />);
    expect(screen.getByText("Nog geen bedrijfsevenementen.")).toBeInTheDocument();
  });

  it("lists events and shows the pending count in the tab", () => {
    emittedEvents = [makeEvent({ status: "pending" }), makeEvent({ id: "evt2", status: "approved" })];
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    expect(screen.getByText("🎉 Bedrijfsevents (1)")).toBeInTheDocument();
    expect(screen.getAllByText(/Test Event/)).toHaveLength(2);
  });

  it("approves a pending event", async () => {
    emittedEvents = [makeEvent({ status: "pending" })];
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("Goedkeuren"));
    expect(approveEvent).toHaveBeenCalledWith("evt1");
  });

  it("rejects a pending event", async () => {
    emittedEvents = [makeEvent({ status: "pending" })];
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("Afwijzen"));
    expect(rejectEvent).toHaveBeenCalledWith("evt1");
  });

  it("does not show approve/reject actions for a non-pending event", () => {
    emittedEvents = [makeEvent({ status: "approved" })];
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    expect(screen.queryByText("Goedkeuren")).not.toBeInTheDocument();
    expect(screen.queryByText("Afwijzen")).not.toBeInTheDocument();
  });

  it("shows an error message when approving fails", async () => {
    emittedEvents = [makeEvent({ status: "pending" })];
    approveEvent.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("Goedkeuren"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic error message when a non-Error is thrown while approving", async () => {
    emittedEvents = [makeEvent({ status: "pending" })];
    approveEvent.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("Goedkeuren"));
    expect(await screen.findByText("Goedkeuren mislukt.")).toBeInTheDocument();
  });
});

describe("AdminEventsPanel umbrellaEvents tab", () => {
  it("switches tabs and lists umbrella events", async () => {
    emittedUmbrellas = [umbrella];
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎪 Grote evenementen (1)"));
    expect(screen.getByText(/Kermis/)).toBeInTheDocument();
  });

  it("opens the umbrella form to create a new umbrella event", async () => {
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎪 Grote evenementen (0)"));
    await user.click(screen.getByText("+ Groot evenement toevoegen"));
    expect(screen.getByRole("dialog", { name: "Groot Tilburgs event toevoegen" })).toBeInTheDocument();
  });

  it("opens the umbrella form pre-filled for editing", async () => {
    emittedUmbrellas = [umbrella];
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎪 Grote evenementen (1)"));
    await user.click(screen.getByText("Bewerken"));
    expect(screen.getByRole("dialog", { name: "Groot Tilburgs event bewerken" })).toBeInTheDocument();
  });

  it("deletes an umbrella event", async () => {
    emittedUmbrellas = [umbrella];
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎪 Grote evenementen (1)"));
    await user.click(screen.getByText("Verwijderen"));
    expect(deleteUmbrellaEvent).toHaveBeenCalledWith("u1");
  });

  it("shows an error message when deleting an umbrella event fails", async () => {
    emittedUmbrellas = [umbrella];
    deleteUmbrellaEvent.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎪 Grote evenementen (1)"));
    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("switches back to the businessEvents tab", async () => {
    emittedEvents = [makeEvent({ status: "pending" })];
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎪 Grote evenementen (0)"));
    await user.click(screen.getByText("🎉 Bedrijfsevents (1)"));
    expect(screen.getByText("Goedkeuren")).toBeInTheDocument();
  });

  it("closes the umbrella form via cancel", async () => {
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎪 Grote evenementen (0)"));
    await user.click(screen.getByText("+ Groot evenement toevoegen"));
    await user.click(screen.getByText("Annuleren"));
    expect(screen.queryByRole("dialog", { name: "Groot Tilburgs event toevoegen" })).not.toBeInTheDocument();
  });
});

describe("AdminEventsPanel reject failure", () => {
  it("shows an error message when rejecting fails", async () => {
    emittedEvents = [makeEvent({ status: "pending" })];
    rejectEvent.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("Afwijzen"));
    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("shows a generic error message when a non-Error is thrown while rejecting", async () => {
    emittedEvents = [makeEvent({ status: "pending" })];
    rejectEvent.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("Afwijzen"));
    expect(await screen.findByText("Afwijzen mislukt.")).toBeInTheDocument();
  });

  it("shows a generic error message when a non-Error is thrown while deleting an umbrella event", async () => {
    emittedUmbrellas = [umbrella];
    deleteUmbrellaEvent.mockRejectedValue("not an Error instance");
    const user = userEvent.setup();
    render(<AdminEventsPanel open onClose={vi.fn()} />);

    await user.click(screen.getByText("🎪 Grote evenementen (1)"));
    await user.click(screen.getByText("Verwijderen"));
    expect(await screen.findByText("Verwijderen mislukt.")).toBeInTheDocument();
  });
});

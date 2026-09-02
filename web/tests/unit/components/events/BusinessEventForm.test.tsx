import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { BusinessEvent } from "@/types/events";
import type { PendingPhoto } from "@/components/common/PhotoUploadField";

vi.mock("@/lib/firebase/businessEvents", () => ({
  createBusinessEvent: vi.fn(),
  updateBusinessEvent: vi.fn(),
}));

vi.mock("@/lib/photos/resolvePhotoUpdate", () => ({
  resolvePhotoUpdate: vi.fn(),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/components/common/PhotoUploadField", () => ({
  PhotoUploadField: (_props: { onPendingPhotoChange: (p: PendingPhoto | null) => void }) => <div />,
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

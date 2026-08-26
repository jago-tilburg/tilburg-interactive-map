import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { BusinessEvent } from "@/types/events";

vi.mock("@/components/events/BusinessEventForm", () => ({
  BusinessEventForm: ({
    active,
    ownerId,
    editingEvent,
    duplicateFrom,
    onDone,
  }: {
    active: boolean;
    ownerId: string;
    editingEvent: BusinessEvent | null;
    duplicateFrom: BusinessEvent | null;
    onDone: () => void;
  }) => (
    <div data-testid="form-stub">
      <span data-testid="active">{String(active)}</span>
      <span data-testid="owner">{ownerId}</span>
      <span data-testid="editing">{editingEvent?.id ?? "none"}</span>
      <span data-testid="duplicating">{duplicateFrom?.id ?? "none"}</span>
      <button onClick={onDone}>done</button>
    </div>
  ),
}));

import { NewEventTab } from "@/components/business/NewEventTab";

function makeEvent(id: string): BusinessEvent {
  return {
    id,
    title: "Event " + id,
    category: "eten",
    description: "",
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    startTime: "10:00",
    endTime: "18:00",
    address: "",
    lat: 0,
    lng: 0,
    ownerId: "u1",
    status: "pending",
    paid: false,
    createdAt: null as never,
  };
}

describe("NewEventTab", () => {
  it("shows 'Nieuw evenement' and passes props through when creating", () => {
    render(
      <NewEventTab active ownerId="u1" editingEvent={null} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.getByRole("heading", { name: "Nieuw evenement" })).toBeInTheDocument();
    expect(screen.getByTestId("active")).toHaveTextContent("true");
    expect(screen.getByTestId("owner")).toHaveTextContent("u1");
    expect(screen.getByTestId("editing")).toHaveTextContent("none");
  });

  it("shows 'Evenement bewerken' when editing, and forwards the editing event", () => {
    const ev = makeEvent("evt1");
    render(
      <NewEventTab active ownerId="u1" editingEvent={ev} duplicateFrom={null} umbrellaEvents={[]} onDone={vi.fn()} />,
    );
    expect(screen.getByRole("heading", { name: "Evenement bewerken" })).toBeInTheDocument();
    expect(screen.getByTestId("editing")).toHaveTextContent("evt1");
  });

  it("forwards the duplicateFrom event", () => {
    const ev = makeEvent("evt2");
    render(
      <NewEventTab
        active
        ownerId="u1"
        editingEvent={null}
        duplicateFrom={ev}
        umbrellaEvents={[]}
        onDone={vi.fn()}
      />,
    );
    expect(screen.getByTestId("duplicating")).toHaveTextContent("evt2");
  });

  it("forwards onDone", () => {
    const onDone = vi.fn();
    render(
      <NewEventTab active ownerId="u1" editingEvent={null} duplicateFrom={null} umbrellaEvents={[]} onDone={onDone} />,
    );
    screen.getByText("done").click();
    expect(onDone).toHaveBeenCalled();
  });
});

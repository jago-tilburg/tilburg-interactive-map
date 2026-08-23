import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UmbrellaEventDetailModal } from "@/components/events/UmbrellaEventDetailModal";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

const umbrella: UmbrellaEvent = {
  id: "u1",
  title: "Kermis",
  description: "Jaarlijkse kermis",
  color: "#b45309",
  startDate: "2026-09-01",
  endDate: "2026-09-10",
  createdAt: null as never,
};

function makeEvent(overrides: Partial<BusinessEvent> = {}): BusinessEvent {
  return {
    id: "evt1",
    title: "Test Event",
    category: "eten",
    description: "desc",
    startDate: "2026-09-02",
    endDate: "2026-09-02",
    startTime: "10:00",
    endTime: "18:00",
    address: "Heuvelplein 1",
    lat: 51.5,
    lng: 5.09,
    ownerId: "owner-uid",
    status: "approved",
    paid: false,
    createdAt: null as never,
    umbrellaEventId: "u1",
    ...overrides,
  };
}

describe("UmbrellaEventDetailModal", () => {
  it("renders nothing when there is no umbrella", () => {
    const { container } = render(
      <UmbrellaEventDetailModal open onClose={vi.fn()} umbrella={null} approvedBusinessEvents={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the empty state when no approved events belong to this umbrella", () => {
    render(
      <UmbrellaEventDetailModal open onClose={vi.fn()} umbrella={umbrella} approvedBusinessEvents={[]} />,
    );
    expect(screen.getByText(/Nog geen goedgekeurde evenementen/)).toBeInTheDocument();
  });

  it("lists only approved events belonging to this umbrella and opens one on click", async () => {
    const onOpenEvent = vi.fn();
    const belonging = makeEvent();
    const notBelonging = makeEvent({ id: "evt2", title: "Other Umbrella Event", umbrellaEventId: "u2" });
    const user = userEvent.setup();

    render(
      <UmbrellaEventDetailModal
        open
        onClose={vi.fn()}
        umbrella={umbrella}
        approvedBusinessEvents={[belonging, notBelonging]}
        onOpenEvent={onOpenEvent}
      />,
    );

    expect(screen.getByText(/Test Event/)).toBeInTheDocument();
    expect(screen.queryByText(/Other Umbrella Event/)).not.toBeInTheDocument();

    await user.click(screen.getByText(/Test Event/));
    expect(onOpenEvent).toHaveBeenCalledWith("evt1");
  });
});

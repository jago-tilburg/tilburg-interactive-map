import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BusinessEventDetailModal } from "@/components/events/BusinessEventDetailModal";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";

const event: BusinessEvent = {
  id: "evt1",
  title: "Test Event",
  category: "muziek",
  description: "A great show",
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
  startDate: "2026-01-01",
  endDate: "2099-01-01",
  createdAt: null as never,
};

describe("BusinessEventDetailModal", () => {
  it("renders nothing when there is no event", () => {
    const { container } = render(
      <BusinessEventDetailModal open onClose={vi.fn()} event={null} umbrellaEvents={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows title, address, schedule, and description", () => {
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={event} umbrellaEvents={[]} />);

    expect(screen.getByRole("dialog", { name: "🎵 Test Event" })).toBeInTheDocument();
    expect(screen.getByText(/Heuvelplein 1/)).toBeInTheDocument();
    expect(screen.getByText("A great show")).toBeInTheDocument();
  });

  it("shows the umbrella badge and calls onOpenUmbrella when clicked", async () => {
    const onOpenUmbrella = vi.fn();
    const user = userEvent.setup();
    render(
      <BusinessEventDetailModal
        open
        onClose={vi.fn()}
        event={event}
        umbrellaEvents={[umbrella]}
        onOpenUmbrella={onOpenUmbrella}
      />,
    );

    const badge = screen.getByText(/Onderdeel van Kermis/);
    await user.click(badge);
    expect(onOpenUmbrella).toHaveBeenCalledWith("u1");
  });

  it("does not show an umbrella badge when the referenced umbrella isn't in the list", () => {
    render(<BusinessEventDetailModal open onClose={vi.fn()} event={event} umbrellaEvents={[]} />);
    expect(screen.queryByText(/Onderdeel van/)).not.toBeInTheDocument();
  });
});

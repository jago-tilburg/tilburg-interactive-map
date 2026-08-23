import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePickerPopover } from "@/components/sidebar/DatePickerPopover";
import type { BusinessEvent } from "@/types/events";

function makeEvent(overrides: Partial<BusinessEvent> = {}): BusinessEvent {
  return {
    id: "evt1",
    title: "Kermis",
    category: "anders",
    description: "",
    startDate: "2026-09-05",
    endDate: "2026-09-05",
    startTime: "10:00",
    endTime: "18:00",
    address: "Heuvelplein 1",
    lat: 51.5,
    lng: 5.09,
    ownerId: "owner-uid",
    status: "approved",
    paid: true,
    createdAt: null as never,
    ...overrides,
  };
}

describe("DatePickerPopover", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <DatePickerPopover open={false} onClose={vi.fn()} events={[]} today="2026-09-01" onSelectDate={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("opens on the current month and shows a dot on days with events", () => {
    render(
      <DatePickerPopover
        open
        onClose={vi.fn()}
        events={[makeEvent({ startDate: "2026-09-05", endDate: "2026-09-05" })]}
        today="2026-09-01"
        onSelectDate={vi.fn()}
      />,
    );

    expect(screen.getByText("september 2026")).toBeInTheDocument();
    const day5 = screen.getByText("5").closest("button")!;
    expect(day5.querySelector('[aria-hidden="true"]')).not.toBeNull();
    const day6 = screen.getByText("6").closest("button")!;
    expect(day6.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("marks every day of a multi-day event", () => {
    render(
      <DatePickerPopover
        open
        onClose={vi.fn()}
        events={[makeEvent({ startDate: "2026-09-03", endDate: "2026-09-06" })]}
        today="2026-09-01"
        onSelectDate={vi.fn()}
      />,
    );

    for (const day of ["3", "4", "5", "6"]) {
      const cell = screen.getByText(day).closest("button")!;
      expect(cell.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it("selects a date and closes", async () => {
    const onSelectDate = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <DatePickerPopover open onClose={onClose} events={[]} today="2026-09-01" onSelectDate={onSelectDate} />,
    );

    await user.click(screen.getByText("15"));
    expect(onSelectDate).toHaveBeenCalledWith("2026-09-15");
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates to the next and previous month", async () => {
    const user = userEvent.setup();
    render(<DatePickerPopover open onClose={vi.fn()} events={[]} today="2026-09-01" onSelectDate={vi.fn()} />);

    await user.click(screen.getByLabelText("Volgende maand"));
    expect(screen.getByText("oktober 2026")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Vorige maand"));
    await user.click(screen.getByLabelText("Vorige maand"));
    expect(screen.getByText("augustus 2026")).toBeInTheDocument();
  });

  it("navigates across a year boundary", async () => {
    const user = userEvent.setup();
    render(<DatePickerPopover open onClose={vi.fn()} events={[]} today="2026-12-01" onSelectDate={vi.fn()} />);

    await user.click(screen.getByLabelText("Volgende maand"));
    expect(screen.getByText("januari 2027")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePickerPopover } from "@/components/mapfilter/DatePickerPopover";
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
    city: "Tilburg",
    status: "approved",
    paid: true,
    createdAt: null as never,
    ...overrides,
  };
}

function setup(props: Partial<Parameters<typeof DatePickerPopover>[0]> = {}) {
  const onSelectDate = vi.fn();
  render(
    <DatePickerPopover
      triggerLabel="📅 Kies specifieke datum"
      triggerClassName="trigger"
      events={[]}
      today="2026-09-01"
      onSelectDate={onSelectDate}
      {...props}
    />,
  );
  return { onSelectDate };
}

describe("DatePickerPopover", () => {
  it("shows only the trigger button when closed", () => {
    setup();
    expect(screen.getByRole("button", { name: /Kies specifieke datum/ })).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("opens the calendar on the current month when the trigger is clicked", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /Kies specifieke datum/ }));
    expect(screen.getByText("september 2026")).toBeInTheDocument();
  });

  it("marks a day with an event", async () => {
    const user = userEvent.setup();
    setup({ events: [makeEvent({ startDate: "2026-09-05", endDate: "2026-09-05" })] });
    await user.click(screen.getByRole("button", { name: /Kies specifieke datum/ }));

    const day5 = screen.getByRole("button", { name: /\b5 september 2026/ }).closest("td")!;
    const day6 = screen.getByRole("button", { name: /\b6 september 2026/ }).closest("td")!;
    expect(day5.className).toMatch(/hasEvent/);
    expect(day6.className).not.toMatch(/hasEvent/);
  });

  it("marks every day of a multi-day event", async () => {
    const user = userEvent.setup();
    setup({ events: [makeEvent({ startDate: "2026-09-03", endDate: "2026-09-06" })] });
    await user.click(screen.getByRole("button", { name: /Kies specifieke datum/ }));

    for (const day of [3, 4, 5, 6]) {
      const cell = screen.getByRole("button", { name: new RegExp(`\\b${day} september 2026`) }).closest("td")!;
      expect(cell.className).toMatch(/hasEvent/);
    }
  });

  it("selects a date and closes", async () => {
    const user = userEvent.setup();
    const { onSelectDate } = setup();
    await user.click(screen.getByRole("button", { name: /Kies specifieke datum/ }));

    await user.click(screen.getByRole("button", { name: /15 september 2026/ }));
    expect(onSelectDate).toHaveBeenCalledWith("2026-09-15");
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("navigates to the next and previous month", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /Kies specifieke datum/ }));

    await user.click(screen.getByRole("button", { name: "Volgende maand" }));
    expect(screen.getByText("oktober 2026")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Vorige maand" }));
    await user.click(screen.getByRole("button", { name: "Vorige maand" }));
    expect(screen.getByText("augustus 2026")).toBeInTheDocument();
  });

  it("navigates across a year boundary", async () => {
    const user = userEvent.setup();
    setup({ today: "2026-12-01" });
    await user.click(screen.getByRole("button", { name: /Kies specifieke datum/ }));

    await user.click(screen.getByRole("button", { name: "Volgende maand" }));
    expect(screen.getByText("januari 2027")).toBeInTheDocument();
  });

  it("closes when clicking outside", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole("button", { name: /Kies specifieke datum/ }));
    expect(screen.getByText("september 2026")).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });
});

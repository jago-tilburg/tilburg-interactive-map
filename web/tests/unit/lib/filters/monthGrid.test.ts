import { describe, it, expect } from "vitest";
import { daysInMonth, leadingBlankCount, monthLabel, shiftMonth } from "@/lib/filters/monthGrid";

describe("daysInMonth", () => {
  it("returns all days for a 31-day month", () => {
    const days = daysInMonth(2026, 8); // September (0-indexed)
    expect(days).toHaveLength(30);
    expect(days[0]).toBe("2026-09-01");
    expect(days.at(-1)).toBe("2026-09-30");
  });

  it("handles February in a leap year", () => {
    const days = daysInMonth(2028, 1);
    expect(days).toHaveLength(29);
  });

  it("handles February in a non-leap year", () => {
    const days = daysInMonth(2026, 1);
    expect(days).toHaveLength(28);
  });
});

describe("leadingBlankCount", () => {
  it("is 0 when the 1st falls on a Monday", () => {
    // 2026-06-01 is a Monday
    expect(leadingBlankCount(2026, 5)).toBe(0);
  });

  it("is 6 when the 1st falls on a Sunday", () => {
    // 2026-03-01 is a Sunday
    expect(leadingBlankCount(2026, 2)).toBe(6);
  });
});

describe("monthLabel", () => {
  it("formats the Dutch month name and year", () => {
    expect(monthLabel(2026, 8)).toBe("september 2026");
    expect(monthLabel(2026, 0)).toBe("januari 2026");
  });
});

describe("shiftMonth", () => {
  it("moves forward within the same year", () => {
    expect(shiftMonth(2026, 5, 1)).toEqual({ year: 2026, month: 6 });
  });

  it("moves backward within the same year", () => {
    expect(shiftMonth(2026, 5, -1)).toEqual({ year: 2026, month: 4 });
  });

  it("rolls over to the next year", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });

  it("rolls back to the previous year", () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

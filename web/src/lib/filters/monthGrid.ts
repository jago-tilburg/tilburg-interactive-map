// Pure calendar-grid math for the date-picker popover, kept separate from
// the component so the day/blank-cell logic is directly unit-testable.

export const WEEKDAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// ISO 'YYYY-MM-DD' strings for every day in the given month (0-indexed,
// matching JS Date's month numbering).
export function daysInMonth(year: number, month: number): string[] {
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${year}-${pad2(month + 1)}-${pad2(i + 1)}`);
}

// Number of empty leading cells so day 1 lands under the right weekday
// column in a Monday-start grid (Ma=0 ... Zo=6).
export function leadingBlankCount(year: number, month: number): number {
  const jsDay = new Date(year, month, 1).getDay(); // 0=Sun..6=Sat
  return (jsDay + 6) % 7;
}

export function monthLabel(year: number, month: number): string {
  const names = [
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december",
  ];
  return `${names[month]} ${year}`;
}

// Shifts a (year, month) pair by `delta` months, rolling over year
// boundaries in either direction.
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

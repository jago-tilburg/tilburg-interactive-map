import type { BusinessEvent, EventCategory } from "@/types/events";

export const EVENT_CATEGORIES: Record<EventCategory, { label: string; emoji: string }> = {
  eten: { label: "Eten & Drinken", emoji: "🍔" },
  muziek: { label: "Muziek", emoji: "🎵" },
  sport: { label: "Sport", emoji: "⚽" },
  markt: { label: "Markt", emoji: "🛍️" },
  anders: { label: "Anders", emoji: "📍" },
};

export function categoryOf(category: string): { label: string; emoji: string } {
  return EVENT_CATEGORIES[category as EventCategory] ?? EVENT_CATEGORIES.anders;
}

// Inclusive list of 'YYYY-MM-DD' strings between startDate and endDate. Stays
// in UTC throughout construction, increment, and readback — mixing local-time
// construction with toISOString()'s UTC output shifts the date by a day in
// any timezone ahead of UTC (caught live in the original app: Tilburg's
// UTC+2 turned a Sep 2 start into Sep 1 in the generated list).
export function dateRangeArray(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cur = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

// Human-readable schedule line, handling both single-day and multi-day (with
// or without per-day time overrides) events.
export function formatBusinessEventSchedule(ev: {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  dailyTimes?: Record<string, { startTime: string; endTime: string }> | null;
}): string {
  const dateLabel =
    ev.endDate && ev.endDate !== ev.startDate ? `${ev.startDate} t/m ${ev.endDate}` : ev.startDate;

  if (ev.dailyTimes && Object.keys(ev.dailyTimes).length > 0) {
    const perDay = Object.entries(ev.dailyTimes)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, t]) => `${date}: ${t.startTime}–${t.endTime}`)
      .join(", ");
    return `${dateLabel} · ${perDay}`;
  }
  return `${dateLabel} · ${ev.startTime}–${ev.endTime}`;
}

export interface Coords {
  lat: number;
  lng: number;
}

// Extracts lat/lng from a pasted Google Maps URL, trying the same patterns
// (in the same order) as the original app: @lat,lng, a place/…/@lat,lng
// permalink, ll=, and q=.
export function extractCoordsFromMapsUrl(url: string): Coords | null {
  if (!url) return null;
  try {
    let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    match = url.match(/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    /* v8 ignore next -- unreachable as ported: any URL matching this place/…/@lat,lng
       pattern also contains the same @lat,lng substring the unanchored regex above
       already matches first, so this branch never fires. Inherited verbatim from the
       original app's extractCoordsFromUrl(); kept for behavioral parity, not fixed here. */
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    match = url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    match = url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    return null;
  } catch {
    return null;
  }
}

export function isMultiDay(startDate: string, endDate: string): boolean {
  return !!(startDate && endDate && startDate !== endDate);
}

// Derives the umbrella-eligible list: active (not-yet-ended) umbrella events,
// same filter the original app applies before populating the select.
export function activeUmbrellaEvents<T extends { endDate: string }>(umbrellaEvents: T[], today: string): T[] {
  return umbrellaEvents.filter((u) => u.endDate >= today);
}

export function businessEventStatusLabel(status: BusinessEvent["status"]): string {
  if (status === "approved") return "Goedgekeurd";
  if (status === "rejected") return "Afgewezen";
  return "In afwachting";
}

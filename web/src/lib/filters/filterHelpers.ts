import type { Shop } from "@/types/shops";
import type { BusinessEvent, EventCategory } from "@/types/events";

export type ContentTypeFilter = "alles" | "broodjes" | "events";
export type DietaryKey = "glutenvrij" | "halal" | "vega";
export type SortOption = "rating-desc" | "rating-asc" | "name-asc" | "name-desc";
// "today"/"tomorrow" are resolved relative to `today` below; any other
// string is treated as a specific 'YYYY-MM-DD' date picked from the
// calendar popover.
export type DateQuickFilter = "today" | "tomorrow" | string | null;

export interface ShopFilterState {
  query: string;
  dietary: DietaryKey[];
}

export interface EventFilterState {
  query: string;
  categories: EventCategory[];
  umbrellaEventId: string | null;
  // "today"/"tomorrow" filtering needs a reference date passed in from the
  // caller (rather than reading Date.now() here) so this stays a pure,
  // easily-testable function.
  dateFilter: DateQuickFilter;
  today: string;
}

// Case/diacritic-insensitive substring match against name + address (shops)
// or title + organizer (events) — mirrors matchesSearchQuery() in the
// prototype, which searches the same field sets.
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesQuery(haystacks: (string | undefined)[], query: string): boolean {
  if (!query.trim()) return true;
  const needle = normalize(query);
  return haystacks.some((h) => h && normalize(h).includes(needle));
}

export function filterShops(shops: Shop[], filters: ShopFilterState): Shop[] {
  return shops.filter((shop) => {
    if (!matchesQuery([shop.name, shop.address], filters.query)) return false;
    if (filters.dietary.length === 0) return true;
    // OR, not AND — mirrors matchesDietaryFilter()'s .some(): checking both
    // "Halal" and "Vega" shows shops that are either, not shops that are both.
    return filters.dietary.some((key) => shop.dietaryOptions?.[key]);
  });
}

// UTC-safe +N days on a 'YYYY-MM-DD' string — same construction as
// dateRangeArray() in eventHelpers.ts, avoiding the local-time/UTC mismatch
// documented there.
export function addDaysToIsoDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Resolves "today"/"tomorrow" to an actual date and checks it falls within
// [startDate, endDate] — shared by filterEvents() below and by the
// hamburger menu's groot-event pills, which apply this same date check to
// an umbrella's own start/end range (a pseudo-event, in the prototype's
// terms), not just to individual business events.
export function dateFilterMatchesRange(
  startDate: string,
  endDate: string,
  dateFilter: DateQuickFilter,
  today: string,
): boolean {
  const targetDate =
    dateFilter === "today" ? today : dateFilter === "tomorrow" ? addDaysToIsoDate(today, 1) : (dateFilter ?? null);
  if (!targetDate) return true;
  return startDate <= targetDate && targetDate <= endDate;
}

export function filterEvents(events: BusinessEvent[], filters: EventFilterState): BusinessEvent[] {
  return events.filter((event) => {
    if (!matchesQuery([event.title, event.address], filters.query)) return false;
    if (filters.categories.length > 0 && !filters.categories.includes(event.category)) return false;
    if (filters.umbrellaEventId && event.umbrellaEventId !== filters.umbrellaEventId) return false;
    if (!dateFilterMatchesRange(event.startDate, event.endDate, filters.dateFilter, filters.today)) return false;
    return true;
  });
}

export function sortShops(shops: Shop[], sort: SortOption): Shop[] {
  const sorted = [...shops];
  switch (sort) {
    case "rating-desc":
      return sorted.sort((a, b) => b.rating - a.rating);
    case "rating-asc":
      return sorted.sort((a, b) => a.rating - b.rating);
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
  }
}

export function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

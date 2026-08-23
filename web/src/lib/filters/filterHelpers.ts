import type { Shop } from "@/types/shops";
import type { BusinessEvent, EventCategory } from "@/types/events";

export type ContentTypeFilter = "alles" | "broodjes" | "events";
export type DietaryKey = "glutenvrij" | "halal" | "vega";
export type SortOption = "rating-desc" | "rating-asc" | "name-asc" | "name-desc";

export interface ShopFilterState {
  query: string;
  dietary: DietaryKey[];
}

export interface EventFilterState {
  query: string;
  categories: EventCategory[];
  umbrellaEventId: string | null;
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
    return filters.dietary.every((key) => shop.dietaryOptions?.[key]);
  });
}

export function filterEvents(events: BusinessEvent[], filters: EventFilterState): BusinessEvent[] {
  return events.filter((event) => {
    if (!matchesQuery([event.title, event.address], filters.query)) return false;
    if (filters.categories.length > 0 && !filters.categories.includes(event.category)) return false;
    if (filters.umbrellaEventId && event.umbrellaEventId !== filters.umbrellaEventId) return false;
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

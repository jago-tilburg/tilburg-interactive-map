import { describe, it, expect } from "vitest";
import {
  matchesQuery,
  filterShops,
  filterEvents,
  sortShops,
  toggleInList,
  addDaysToIsoDate,
} from "@/lib/filters/filterHelpers";
import type { Shop } from "@/types/shops";
import type { BusinessEvent } from "@/types/events";

function makeShop(overrides: Partial<Shop> = {}): Shop {
  return {
    id: 1,
    name: "Café Zuid",
    address: "Heuvelstraat 1",
    lat: 51.5,
    lng: 5.09,
    rating: 8,
    price: "€€",
    photoUrl: "",
    review: "",
    tiktokUrl: "",
    instagramUrl: "",
    dietaryOptions: { glutenvrij: false, halal: false, vega: false },
    createdAt: "2026-01-01",
    likes: [],
    comments: [],
    userReviews: [],
    userRatings: [],
    ...overrides,
  };
}

function makeEvent(overrides: Partial<BusinessEvent> = {}): BusinessEvent {
  return {
    id: "e1",
    title: "Zomerfeest",
    category: "muziek",
    description: "",
    startDate: "2026-09-01",
    endDate: "2026-09-01",
    startTime: "10:00",
    endTime: "18:00",
    address: "Heuvelplein 1",
    lat: 51.5,
    lng: 5.09,
    ownerId: "owner-1",
    city: "Tilburg",
    status: "approved",
    paid: true,
    createdAt: null as never,
    ...overrides,
  };
}

describe("matchesQuery", () => {
  it("matches when the query is empty", () => {
    expect(matchesQuery(["Café Zuid"], "")).toBe(true);
    expect(matchesQuery(["Café Zuid"], "   ")).toBe(true);
  });

  it("matches case- and diacritic-insensitively", () => {
    expect(matchesQuery(["Café Zuid"], "cafe")).toBe(true);
    expect(matchesQuery(["Café Zuid"], "CAFE ZUID")).toBe(true);
  });

  it("matches against any provided haystack", () => {
    expect(matchesQuery([undefined, "Heuvelstraat 1"], "heuvel")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchesQuery(["Café Zuid", undefined], "pizza")).toBe(false);
  });
});

describe("filterShops", () => {
  const shops = [
    makeShop({ id: 1, name: "Café Zuid", dietaryOptions: { glutenvrij: true, halal: false, vega: false } }),
    makeShop({ id: 2, name: "Broodjeshuis Noord", dietaryOptions: { glutenvrij: false, halal: true, vega: true } }),
  ];

  it("filters by search query", () => {
    expect(filterShops(shops, { query: "zuid", dietary: [] })).toEqual([shops[0]]);
  });

  it("filters by dietary requirements (every() must match)", () => {
    expect(filterShops(shops, { query: "", dietary: ["halal", "vega"] })).toEqual([shops[1]]);
  });

  it("returns everything when no filters are active", () => {
    expect(filterShops(shops, { query: "", dietary: [] })).toEqual(shops);
  });
});

describe("addDaysToIsoDate", () => {
  it("adds days within the same month", () => {
    expect(addDaysToIsoDate("2026-09-01", 1)).toBe("2026-09-02");
  });

  it("rolls over a month boundary", () => {
    expect(addDaysToIsoDate("2026-09-30", 1)).toBe("2026-10-01");
  });

  it("rolls over a year boundary", () => {
    expect(addDaysToIsoDate("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("filterEvents", () => {
  const umbrellaId = "u1";
  const today = "2026-09-05";
  const base = { query: "", categories: [] as never[], umbrellaEventId: null, dateFilter: null, today };
  const events = [
    makeEvent({ id: "e1", title: "Kermis Rit", category: "anders", umbrellaEventId: umbrellaId, startDate: today, endDate: today }),
    makeEvent({ id: "e2", title: "Live Muziek", category: "muziek", startDate: "2026-09-06", endDate: "2026-09-06" }),
    makeEvent({ id: "e3", title: "Multi-day fest", category: "markt", startDate: "2026-09-04", endDate: "2026-09-07" }),
  ];

  it("filters by search query", () => {
    expect(filterEvents(events, { ...base, query: "kermis" })).toEqual([events[0]]);
  });

  it("filters by category list", () => {
    expect(filterEvents(events, { ...base, categories: ["muziek"] })).toEqual([events[1]]);
  });

  it("filters by umbrella event id", () => {
    expect(filterEvents(events, { ...base, umbrellaEventId: umbrellaId })).toEqual([events[0]]);
  });

  it("filters to events happening today (inclusive of multi-day ranges)", () => {
    expect(filterEvents(events, { ...base, dateFilter: "today" })).toEqual([events[0], events[2]]);
  });

  it("filters to events happening tomorrow", () => {
    expect(filterEvents(events, { ...base, dateFilter: "tomorrow" })).toEqual([events[1], events[2]]);
  });

  it("returns everything when no filters are active", () => {
    expect(filterEvents(events, base)).toEqual(events);
  });
});

describe("sortShops", () => {
  const shops = [
    makeShop({ id: 1, name: "Bravo", rating: 5 }),
    makeShop({ id: 2, name: "Alpha", rating: 9 }),
  ];

  it("sorts by rating descending", () => {
    expect(sortShops(shops, "rating-desc").map((s) => s.id)).toEqual([2, 1]);
  });

  it("sorts by rating ascending", () => {
    expect(sortShops(shops, "rating-asc").map((s) => s.id)).toEqual([1, 2]);
  });

  it("sorts by name ascending", () => {
    expect(sortShops(shops, "name-asc").map((s) => s.id)).toEqual([2, 1]);
  });

  it("sorts by name descending", () => {
    expect(sortShops(shops, "name-desc").map((s) => s.id)).toEqual([1, 2]);
  });

  it("does not mutate the input array", () => {
    const original = [...shops];
    sortShops(shops, "rating-desc");
    expect(shops).toEqual(original);
  });
});

describe("toggleInList", () => {
  it("adds a value not already present", () => {
    expect(toggleInList(["a"], "b")).toEqual(["a", "b"]);
  });

  it("removes a value already present", () => {
    expect(toggleInList(["a", "b"], "a")).toEqual(["b"]);
  });
});

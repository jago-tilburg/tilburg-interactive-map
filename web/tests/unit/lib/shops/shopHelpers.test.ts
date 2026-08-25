import { describe, it, expect } from "vitest";
import {
  shopsSnapshotToArray,
  nextUserRating,
  averageRating,
  buildComment,
  buildUserReview,
  ratingColor,
  RATING_SELECT_OPTIONS,
  computeAnonymousDataMigration,
} from "@/lib/shops/shopHelpers";
import type { Shop } from "@/types/shops";

function makeShop(overrides: Partial<Shop> & { id: number }): Shop {
  return {
    name: "Shop",
    address: "Addr 1",
    lat: 51.5,
    lng: 5.09,
    rating: 8,
    price: "€€",
    photoUrl: "",
    review: "",
    tiktokUrl: "",
    instagramUrl: "",
    dietaryOptions: { glutenvrij: false, halal: false, vega: false },
    createdAt: "2026-01-01T00:00:00.000Z",
    likes: [],
    comments: [],
    userReviews: [],
    userRatings: [],
    ...overrides,
  };
}

describe("shopsSnapshotToArray", () => {
  it("returns an empty array for null/undefined", () => {
    expect(shopsSnapshotToArray(null)).toEqual([]);
    expect(shopsSnapshotToArray(undefined)).toEqual([]);
  });

  it("filters falsy entries out of an array snapshot", () => {
    const a = { id: 1, likes: [], comments: [], userReviews: [], userRatings: [] };
    expect(shopsSnapshotToArray([a, null, undefined])).toEqual([a]);
  });

  it("converts an id-keyed object snapshot to an array", () => {
    const a = { id: 1, likes: [], comments: [], userReviews: [], userRatings: [] };
    const b = { id: 2, likes: [], comments: [], userReviews: [], userRatings: [] };
    expect(shopsSnapshotToArray({ "1": a, "2": b })).toEqual([a, b]);
  });

  it("defaults likes/comments/userReviews/userRatings to [] when RTDB dropped them (empty-array fields aren't stored)", () => {
    // A freshly-created shop with zero interactions so far — this is
    // exactly what a real RTDB snapshot looks like, confirmed against
    // staging: writing `likes: []` on create never actually lands a
    // `likes` key at all.
    const bare = { id: 9001, name: "Test Shop" };
    const [shop] = shopsSnapshotToArray({ "9001": bare });
    expect(shop.likes).toEqual([]);
    expect(shop.comments).toEqual([]);
    expect(shop.userReviews).toEqual([]);
    expect(shop.userRatings).toEqual([]);
  });

  it("converts the keyed-object RTDB storage shape (likes: {userId: true}, rest: {itemId: {...}}) back to arrays", () => {
    const raw = {
      id: 9002,
      likes: { u1: true },
      comments: { "1": { id: 1, userId: "u1", userName: "A", text: "x", createdAt: "t" } },
      userReviews: {},
      userRatings: {},
    };
    const [shop] = shopsSnapshotToArray([raw]);
    expect(shop.likes).toEqual(["u1"]);
    expect(shop.comments).toEqual([{ id: 1, userId: "u1", userName: "A", text: "x", createdAt: "t" }]);
  });
});

describe("nextUserRating", () => {
  it("builds a new rating for a first-time rater", () => {
    const result = nextUserRating(undefined, "u1", 8);
    expect(result).toMatchObject({ userId: "u1", rating: 8 });
    expect(result.updatedAt).toBeUndefined();
  });

  it("updates an existing rating in place, stamping updatedAt", () => {
    const existing = { userId: "u1", rating: 5, createdAt: 100 };
    const result = nextUserRating(existing, "u1", 9);
    expect(result).toMatchObject({ userId: "u1", rating: 9, createdAt: 100 });
    expect(result.updatedAt).toBeDefined();
  });

  it("does not mutate the existing rating", () => {
    const existing = { userId: "u1", rating: 5, createdAt: 100 };
    nextUserRating(existing, "u1", 9);
    expect(existing.rating).toBe(5);
  });
});

describe("averageRating", () => {
  it("returns null when there are no ratings", () => {
    expect(averageRating(undefined)).toBeNull();
    expect(averageRating([])).toBeNull();
  });

  it("returns the rounded-to-1-decimal average", () => {
    const ratings = [
      { userId: "u1", rating: 8, createdAt: 1 },
      { userId: "u2", rating: 9, createdAt: 2 },
      { userId: "u3", rating: 7, createdAt: 3 },
    ];
    expect(averageRating(ratings)).toBe(8);
  });

  it("rounds a non-terminating average to one decimal", () => {
    const ratings = [
      { userId: "u1", rating: 8, createdAt: 1 },
      { userId: "u2", rating: 9, createdAt: 2 },
      { userId: "u3", rating: 9, createdAt: 3 },
    ];
    expect(averageRating(ratings)).toBe(8.7);
  });
});

describe("buildComment", () => {
  it("builds a comment with a generated id and timestamp", () => {
    const result = buildComment({ userId: "u1", userName: "Jago", text: "Lekker!" });
    expect(result).toMatchObject({ userId: "u1", userName: "Jago", text: "Lekker!" });
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
  });
});

describe("buildUserReview", () => {
  it("builds a review with a generated id and timestamp", () => {
    const result = buildUserReview({ userId: "u1", userName: "Jago", rating: 9, text: "Top" });
    expect(result).toMatchObject({ userId: "u1", userName: "Jago", rating: 9, text: "Top" });
    expect(result.id).toBeDefined();
  });
});

describe("RATING_SELECT_OPTIONS", () => {
  it("has 91 options from 10.0 down to 1.0 in 0.1 steps", () => {
    expect(RATING_SELECT_OPTIONS).toHaveLength(91);
    expect(RATING_SELECT_OPTIONS[0]).toBe("10.0");
    expect(RATING_SELECT_OPTIONS[1]).toBe("9.9");
    expect(RATING_SELECT_OPTIONS[RATING_SELECT_OPTIONS.length - 1]).toBe("1.0");
  });
});

describe("computeAnonymousDataMigration", () => {
  it("returns no patches when oldId is empty or equal to newId", () => {
    const shops = [makeShop({ id: 1, likes: ["anon-1"] })];
    expect(computeAnonymousDataMigration(shops, "", "uid-1")).toEqual({ patches: [], migrated: 0 });
    expect(computeAnonymousDataMigration(shops, "uid-1", "uid-1")).toEqual({ patches: [], migrated: 0 });
  });

  it("re-tags a like from the anon id to the new uid via a keyed move", () => {
    const shops = [makeShop({ id: 1, likes: ["anon-1", "other"] })];
    const { patches, migrated } = computeAnonymousDataMigration(shops, "anon-1", "uid-1");
    expect(migrated).toBe(1);
    expect(patches).toEqual([{ shopId: 1, updates: { "likes/anon-1": null, "likes/uid-1": true } }]);
  });

  it("dedupes a like when the new uid already liked the same shop (no redundant write)", () => {
    const shops = [makeShop({ id: 1, likes: ["anon-1", "uid-1"] })];
    const { patches, migrated } = computeAnonymousDataMigration(shops, "anon-1", "uid-1");
    expect(migrated).toBe(1);
    expect(patches).toEqual([{ shopId: 1, updates: { "likes/anon-1": null } }]);
  });

  it("re-tags the anon rating via a keyed move, overwriting any existing rating from the new uid", () => {
    const shops = [
      makeShop({
        id: 1,
        userRatings: [
          { userId: "anon-1", rating: 9, createdAt: 100 },
          { userId: "uid-1", rating: 3, createdAt: 50 },
        ],
      }),
    ];
    const { patches, migrated } = computeAnonymousDataMigration(shops, "anon-1", "uid-1");
    expect(migrated).toBe(1);
    expect(patches).toEqual([
      {
        shopId: 1,
        updates: {
          "userRatings/anon-1": null,
          "userRatings/uid-1": { userId: "uid-1", rating: 9, createdAt: 100 },
        },
      },
    ]);
  });

  it("re-tags every comment and review from the anon id via a per-key userId field patch, counting each one", () => {
    const shops = [
      makeShop({
        id: 1,
        comments: [
          { id: 101, userId: "anon-1", userName: "Jago", text: "a", createdAt: "t" },
          { id: 102, userId: "anon-1", userName: "Jago", text: "b", createdAt: "t" },
          { id: 103, userId: "other", userName: "X", text: "c", createdAt: "t" },
        ],
        userReviews: [
          { id: 201, userId: "anon-1", userName: "Jago", rating: 8, text: "top", createdAt: "t" },
          { id: 202, userId: "other", userName: "X", rating: 6, text: "meh", createdAt: "t" },
        ],
      }),
    ];
    const { patches, migrated } = computeAnonymousDataMigration(shops, "anon-1", "uid-1");
    expect(migrated).toBe(3);
    expect(patches).toEqual([
      {
        shopId: 1,
        updates: {
          "comments/101/userId": "uid-1",
          "comments/102/userId": "uid-1",
          "userReviews/201/userId": "uid-1",
        },
      },
    ]);
  });

  it("treats missing comments/userReviews arrays as empty rather than throwing", () => {
    const shop = makeShop({ id: 1, likes: ["anon-1"] });
    // @ts-expect-error -- simulating a legacy/partial RTDB record with the arrays absent
    delete shop.comments;
    // @ts-expect-error -- same, for userReviews
    delete shop.userReviews;

    const { patches, migrated } = computeAnonymousDataMigration([shop], "anon-1", "uid-1");

    expect(migrated).toBe(1);
    expect(patches).toEqual([{ shopId: 1, updates: { "likes/anon-1": null, "likes/uid-1": true } }]);
  });

  it("skips shops with nothing tied to the anon id and only patches the ones that changed", () => {
    const untouched = makeShop({ id: 1, likes: ["someone-else"] });
    const touched = makeShop({ id: 2, likes: ["anon-1"] });
    const { patches, migrated } = computeAnonymousDataMigration([untouched, touched], "anon-1", "uid-1");
    expect(migrated).toBe(1);
    expect(patches).toEqual([{ shopId: 2, updates: { "likes/anon-1": null, "likes/uid-1": true } }]);
  });
});

describe("ratingColor", () => {
  it("returns green for >= 7", () => {
    expect(ratingColor(7)).toBe("#16a34a");
    expect(ratingColor(10)).toBe("#16a34a");
  });

  it("returns amber for 5-6.9", () => {
    expect(ratingColor(5)).toBe("#d97706");
    expect(ratingColor(6.9)).toBe("#d97706");
  });

  it("returns red below 5", () => {
    expect(ratingColor(4.9)).toBe("#dc2626");
    expect(ratingColor(0)).toBe("#dc2626");
  });
});

import { describe, it, expect } from "vitest";
import {
  shopsSnapshotToArray,
  toggleLike,
  upsertUserRating,
  averageRating,
  addComment,
  removeComment,
  addUserReview,
  removeUserReview,
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

  it("leaves already-present interaction arrays untouched", () => {
    const shopWithData = {
      id: 9002,
      likes: ["u1"],
      comments: [{ id: 1, userId: "u1", userName: "A", text: "x", createdAt: "t" }],
      userReviews: [],
      userRatings: [],
    };
    const [shop] = shopsSnapshotToArray([shopWithData]);
    expect(shop.likes).toEqual(["u1"]);
    expect(shop.comments).toEqual(shopWithData.comments);
  });
});

describe("toggleLike", () => {
  it("adds the userId when not already liked", () => {
    expect(toggleLike(undefined, "u1")).toEqual(["u1"]);
    expect(toggleLike(["u2"], "u1")).toEqual(["u2", "u1"]);
  });

  it("removes the userId when already liked", () => {
    expect(toggleLike(["u1", "u2"], "u1")).toEqual(["u2"]);
  });
});

describe("upsertUserRating", () => {
  it("adds a new rating for a first-time rater", () => {
    const result = upsertUserRating(undefined, "u1", 8);
    expect(result).toEqual([expect.objectContaining({ userId: "u1", rating: 8 })]);
  });

  it("updates an existing rating in place, stamping updatedAt", () => {
    const existing = [{ userId: "u1", rating: 5, createdAt: 100 }];
    const result = upsertUserRating(existing, "u1", 9);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ userId: "u1", rating: 9, createdAt: 100 });
    expect(result[0].updatedAt).toBeDefined();
  });

  it("does not mutate the input array", () => {
    const existing = [{ userId: "u1", rating: 5, createdAt: 100 }];
    upsertUserRating(existing, "u1", 9);
    expect(existing[0].rating).toBe(5);
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

describe("addComment / removeComment", () => {
  it("appends a comment with a generated id and timestamp", () => {
    const result = addComment(undefined, { userId: "u1", userName: "Jago", text: "Lekker!" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ userId: "u1", userName: "Jago", text: "Lekker!" });
    expect(result[0].id).toBeDefined();
  });

  it("removes a comment by id", () => {
    const comments = [
      { id: 1, userId: "u1", userName: "A", text: "x", createdAt: "t" },
      { id: 2, userId: "u2", userName: "B", text: "y", createdAt: "t" },
    ];
    expect(removeComment(comments, 1)).toEqual([comments[1]]);
  });

  it("returns an empty array when removing from an undefined list", () => {
    expect(removeComment(undefined, 1)).toEqual([]);
  });
});

describe("addUserReview / removeUserReview", () => {
  it("appends a review with a generated id and timestamp", () => {
    const result = addUserReview(undefined, { userId: "u1", userName: "Jago", rating: 9, text: "Top" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ userId: "u1", userName: "Jago", rating: 9, text: "Top" });
  });

  it("removes a review by id", () => {
    const reviews = [
      { id: 1, userId: "u1", userName: "A", rating: 8, text: "x", createdAt: "t" },
      { id: 2, userId: "u2", userName: "B", rating: 9, text: "y", createdAt: "t" },
    ];
    expect(removeUserReview(reviews, 1)).toEqual([reviews[1]]);
  });

  it("returns an empty array when removing from an undefined list", () => {
    expect(removeUserReview(undefined, 1)).toEqual([]);
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

  it("re-tags a like from the anon id to the new uid", () => {
    const shops = [makeShop({ id: 1, likes: ["anon-1", "other"] })];
    const { patches, migrated } = computeAnonymousDataMigration(shops, "anon-1", "uid-1");
    expect(migrated).toBe(1);
    expect(patches).toEqual([{ shopId: 1, likes: ["other", "uid-1"] }]);
  });

  it("dedupes a like when the new uid already liked the same shop", () => {
    const shops = [makeShop({ id: 1, likes: ["anon-1", "uid-1"] })];
    const { patches, migrated } = computeAnonymousDataMigration(shops, "anon-1", "uid-1");
    expect(migrated).toBe(1);
    expect(patches).toEqual([{ shopId: 1, likes: ["uid-1"] }]);
  });

  it("re-tags the anon rating, overwriting any existing rating from the new uid", () => {
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
      { shopId: 1, userRatings: [{ userId: "uid-1", rating: 9, createdAt: 100 }] },
    ]);
  });

  it("re-tags every comment and review from the anon id, counting each one", () => {
    const shops = [
      makeShop({
        id: 1,
        comments: [
          { id: 1, userId: "anon-1", userName: "Jago", text: "a", createdAt: "t" },
          { id: 2, userId: "anon-1", userName: "Jago", text: "b", createdAt: "t" },
          { id: 3, userId: "other", userName: "X", text: "c", createdAt: "t" },
        ],
        userReviews: [
          { id: 1, userId: "anon-1", userName: "Jago", rating: 8, text: "top", createdAt: "t" },
          { id: 2, userId: "other", userName: "X", rating: 6, text: "meh", createdAt: "t" },
        ],
      }),
    ];
    const { patches, migrated } = computeAnonymousDataMigration(shops, "anon-1", "uid-1");
    expect(migrated).toBe(3);
    expect(patches[0].comments).toEqual([
      { id: 1, userId: "uid-1", userName: "Jago", text: "a", createdAt: "t" },
      { id: 2, userId: "uid-1", userName: "Jago", text: "b", createdAt: "t" },
      { id: 3, userId: "other", userName: "X", text: "c", createdAt: "t" },
    ]);
    expect(patches[0].userReviews).toEqual([
      { id: 1, userId: "uid-1", userName: "Jago", rating: 8, text: "top", createdAt: "t" },
      { id: 2, userId: "other", userName: "X", rating: 6, text: "meh", createdAt: "t" },
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
    expect(patches).toEqual([{ shopId: 1, likes: ["uid-1"] }]);
  });

  it("skips shops with nothing tied to the anon id and only patches the ones that changed", () => {
    const untouched = makeShop({ id: 1, likes: ["someone-else"] });
    const touched = makeShop({ id: 2, likes: ["anon-1"] });
    const { patches, migrated } = computeAnonymousDataMigration([untouched, touched], "anon-1", "uid-1");
    expect(migrated).toBe(1);
    expect(patches).toEqual([{ shopId: 2, likes: ["uid-1"] }]);
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

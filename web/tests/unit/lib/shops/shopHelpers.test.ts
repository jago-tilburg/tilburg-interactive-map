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
} from "@/lib/shops/shopHelpers";

describe("shopsSnapshotToArray", () => {
  it("returns an empty array for null/undefined", () => {
    expect(shopsSnapshotToArray(null)).toEqual([]);
    expect(shopsSnapshotToArray(undefined)).toEqual([]);
  });

  it("filters falsy entries out of an array snapshot", () => {
    const a = { id: 1 };
    expect(shopsSnapshotToArray([a, null, undefined])).toEqual([a]);
  });

  it("converts an id-keyed object snapshot to an array", () => {
    const a = { id: 1 };
    const b = { id: 2 };
    expect(shopsSnapshotToArray({ "1": a, "2": b })).toEqual([a, b]);
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

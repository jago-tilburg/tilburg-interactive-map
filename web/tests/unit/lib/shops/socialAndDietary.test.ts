import { describe, it, expect } from "vitest";
import { activeDietaryBadges } from "@/lib/shops/socialAndDietary";

describe("activeDietaryBadges", () => {
  it("returns an empty array when options is undefined", () => {
    expect(activeDietaryBadges(undefined)).toEqual([]);
  });

  it("returns only the active badges", () => {
    const badges = activeDietaryBadges({ glutenvrij: true, halal: false, vega: true });
    expect(badges.map((b) => b.key)).toEqual(["glutenvrij", "vega"]);
  });

  it("returns an empty array when nothing is active", () => {
    expect(activeDietaryBadges({ glutenvrij: false, halal: false, vega: false })).toEqual([]);
  });
});

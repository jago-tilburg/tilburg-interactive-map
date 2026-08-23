import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = { name: "mock-db" };
const refs = new Map<string, { path: string }>();

function refFor(path: string) {
  if (!refs.has(path)) refs.set(path, { path });
  return refs.get(path)!;
}

vi.mock("firebase/database", () => ({
  getDatabase: vi.fn(() => mockDb),
  ref: vi.fn((_db, path: string) => refFor(path)),
  onValue: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  get: vi.fn(),
}));

vi.mock("@/lib/firebase/app", () => ({
  getFirebaseApp: vi.fn(() => ({ name: "mock-app" })),
}));

import {
  subscribeShops,
  createShop,
  updateShop,
  deleteShop,
  setShopLikes,
  setShopComments,
  setShopUserRatings,
  setShopUserReviews,
  getShopsOnce,
  migrateAnonymousDataToVisitor,
  trackShopView,
  getShopViews,
} from "@/lib/firebase/shops";
import { onValue, set, update, remove, get } from "firebase/database";
import type { ShopInput } from "@/types/shops";

beforeEach(() => {
  vi.clearAllMocks();
  refs.clear();
});

const shopInput: ShopInput = {
  name: "Test Shop",
  address: "Heuvelplein 1",
  lat: 51.5,
  lng: 5.09,
  rating: 8,
  price: "€€",
  photoUrl: "",
  review: "Nice",
  tiktokUrl: "",
  instagramUrl: "",
  dietaryOptions: { glutenvrij: false, halal: false, vega: false },
};

describe("subscribeShops", () => {
  it("normalizes the snapshot into a shop array", () => {
    const onChange = vi.fn();
    vi.mocked(onValue).mockImplementation((_ref: unknown, next: unknown) => {
      (next as (snap: unknown) => void)({ val: () => ({ "9001": { id: 9001, name: "A" } }) });
      return vi.fn();
    });

    subscribeShops(onChange);

    expect(onChange).toHaveBeenCalledWith([{ id: 9001, name: "A" }]);
  });

  it("forwards errors to onError", () => {
    const onError = vi.fn();
    const error = new Error("boom");
    vi.mocked(onValue).mockImplementation((_ref: unknown, _next: unknown, errCb: unknown) => {
      (errCb as (e: Error) => void)(error);
      return vi.fn();
    });

    subscribeShops(vi.fn(), onError);

    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe("createShop", () => {
  it("writes a new shop keyed by a generated id, with empty interaction arrays", async () => {
    const shop = await createShop(shopInput);

    expect(shop.id).toBeDefined();
    expect(shop.likes).toEqual([]);
    expect(shop.comments).toEqual([]);
    expect(shop.userReviews).toEqual([]);
    expect(shop.userRatings).toEqual([]);
    expect(set).toHaveBeenCalledWith(refFor(`shops/${shop.id}`), shop);
  });
});

describe("updateShop", () => {
  it("updates the shop at shops/{id}", async () => {
    await updateShop(9001, { name: "New Name" });
    expect(update).toHaveBeenCalledWith(refFor("shops/9001"), { name: "New Name" });
  });
});

describe("deleteShop", () => {
  it("removes the shop at shops/{id}", async () => {
    await deleteShop(9001);
    expect(remove).toHaveBeenCalledWith(refFor("shops/9001"));
  });
});

describe("setShopLikes / setShopComments / setShopUserRatings / setShopUserReviews", () => {
  it("write to the correct sub-paths", async () => {
    await setShopLikes(9001, ["u1"]);
    expect(set).toHaveBeenCalledWith(refFor("shops/9001/likes"), ["u1"]);

    await setShopComments(9001, []);
    expect(set).toHaveBeenCalledWith(refFor("shops/9001/comments"), []);

    await setShopUserRatings(9001, []);
    expect(set).toHaveBeenCalledWith(refFor("shops/9001/userRatings"), []);

    await setShopUserReviews(9001, []);
    expect(set).toHaveBeenCalledWith(refFor("shops/9001/userReviews"), []);
  });
});

describe("getShopsOnce", () => {
  it("reads shops/ once and normalizes the snapshot", async () => {
    vi.mocked(get).mockResolvedValue({ val: () => ({ "9001": { id: 9001, name: "A" } }) } as never);
    const result = await getShopsOnce();
    expect(get).toHaveBeenCalledWith(refFor("shops"));
    expect(result).toEqual([{ id: 9001, name: "A" }]);
  });
});

describe("migrateAnonymousDataToVisitor", () => {
  it("writes only the changed fields for shops touched by the anon id", async () => {
    vi.mocked(get).mockResolvedValue({
      val: () => ({
        "9001": { id: 9001, likes: ["anon-1"], comments: [], userReviews: [], userRatings: [] },
        "9002": { id: 9002, likes: ["someone-else"], comments: [], userReviews: [], userRatings: [] },
      }),
    } as never);

    const migrated = await migrateAnonymousDataToVisitor("anon-1", "uid-1");

    expect(migrated).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(refFor("shops/9001"), { likes: ["uid-1"] });
  });

  it("does not write anything when nothing is tied to the anon id", async () => {
    vi.mocked(get).mockResolvedValue({
      val: () => ({ "9001": { id: 9001, likes: ["someone-else"], comments: [], userReviews: [], userRatings: [] } }),
    } as never);

    const migrated = await migrateAnonymousDataToVisitor("anon-1", "uid-1");

    expect(migrated).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("trackShopView", () => {
  it("reads the current count and increments it by one", async () => {
    vi.mocked(get).mockResolvedValue({ val: () => 4 } as never);
    const result = await trackShopView(9001);

    expect(result).toBe(5);
    expect(set).toHaveBeenCalledWith(refFor("shopViews/9001"), 5);
  });

  it("starts from zero when there is no existing count", async () => {
    vi.mocked(get).mockResolvedValue({ val: () => null } as never);
    const result = await trackShopView(9001);

    expect(result).toBe(1);
  });
});

describe("getShopViews", () => {
  it("returns the stored view count", async () => {
    vi.mocked(get).mockResolvedValue({ val: () => 7 } as never);
    expect(await getShopViews(9001)).toBe(7);
  });

  it("returns zero when there is no data", async () => {
    vi.mocked(get).mockResolvedValue({ val: () => null } as never);
    expect(await getShopViews(9001)).toBe(0);
  });
});

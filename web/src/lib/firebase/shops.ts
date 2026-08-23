import { ref, onValue, set, update, remove, get, type Unsubscribe } from "firebase/database";
import { getRtdb } from "./database";
import { shopsSnapshotToArray } from "@/lib/shops/shopHelpers";
import type { Shop, ShopComment, ShopUserRating, ShopUserReview, ShopInput } from "@/types/shops";

export function subscribeShops(
  onChange: (shops: Shop[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(getRtdb(), "shops"),
    (snap) => onChange(shopsSnapshotToArray(snap.val())),
    (error) => onError?.(error),
  );
}

export async function createShop(input: ShopInput): Promise<Shop> {
  const shop: Shop = {
    ...input,
    id: Date.now(),
    likes: [],
    comments: [],
    userReviews: [],
    userRatings: [],
    createdAt: new Date().toISOString(),
  };
  await set(ref(getRtdb(), `shops/${shop.id}`), shop);
  return shop;
}

export async function updateShop(shopId: number, patch: Partial<ShopInput>) {
  return update(ref(getRtdb(), `shops/${shopId}`), patch);
}

export async function deleteShop(shopId: number) {
  return remove(ref(getRtdb(), `shops/${shopId}`));
}

export async function setShopLikes(shopId: number, likes: string[]) {
  return set(ref(getRtdb(), `shops/${shopId}/likes`), likes);
}

export async function setShopComments(shopId: number, comments: ShopComment[]) {
  return set(ref(getRtdb(), `shops/${shopId}/comments`), comments);
}

export async function setShopUserRatings(shopId: number, ratings: ShopUserRating[]) {
  return set(ref(getRtdb(), `shops/${shopId}/userRatings`), ratings);
}

export async function setShopUserReviews(shopId: number, reviews: ShopUserReview[]) {
  return set(ref(getRtdb(), `shops/${shopId}/userReviews`), reviews);
}

export async function trackShopView(shopId: number) {
  const viewRef = ref(getRtdb(), `shopViews/${shopId}`);
  const snap = await get(viewRef);
  const current = (snap.val() as number) || 0;
  await set(viewRef, current + 1);
  return current + 1;
}

export async function getShopViews(shopId: number): Promise<number> {
  const snap = await get(ref(getRtdb(), `shopViews/${shopId}`));
  return (snap.val() as number) || 0;
}

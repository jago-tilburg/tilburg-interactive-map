import { ref, onValue, set, update, remove, get, type Unsubscribe } from "firebase/database";
import { getRtdb } from "./database";
import { shopsSnapshotToArray, computeAnonymousDataMigration } from "@/lib/shops/shopHelpers";
import type { Shop, ShopComment, ShopUserRating, ShopUserReview, ShopInput, ShopMigrationPatch } from "@/types/shops";

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

// Each of these writes (or deletes) a single keyed child under shops/{id}
// — never the whole comments/likes/userRatings/userReviews subtree — so a
// caller can at most touch one item, matching database.rules.json's
// per-$key write grants (no more parent-level `.write: true`).
export async function setShopLike(shopId: number, userId: string, liked: boolean) {
  const likeRef = ref(getRtdb(), `shops/${shopId}/likes/${userId}`);
  return liked ? set(likeRef, true) : remove(likeRef);
}

export async function setShopUserRating(shopId: number, userId: string, rating: ShopUserRating) {
  return set(ref(getRtdb(), `shops/${shopId}/userRatings/${userId}`), rating);
}

export async function addShopComment(shopId: number, comment: ShopComment) {
  return set(ref(getRtdb(), `shops/${shopId}/comments/${comment.id}`), comment);
}

export async function removeShopComment(shopId: number, commentId: number) {
  return remove(ref(getRtdb(), `shops/${shopId}/comments/${commentId}`));
}

export async function addShopUserReview(shopId: number, review: ShopUserReview) {
  return set(ref(getRtdb(), `shops/${shopId}/userReviews/${review.id}`), review);
}

export async function removeShopUserReview(shopId: number, reviewId: number) {
  return remove(ref(getRtdb(), `shops/${shopId}/userReviews/${reviewId}`));
}

export async function getShopsOnce(): Promise<Shop[]> {
  const snap = await get(ref(getRtdb(), "shops"));
  return shopsSnapshotToArray(snap.val());
}

async function applyShopMigrationPatches(patches: ShopMigrationPatch[]) {
  await Promise.all(
    patches.map(({ shopId, updates }) => update(ref(getRtdb(), `shops/${shopId}`), updates)),
  );
}

// Re-tags a signed-in-for-the-first-time visitor's pre-login likes/rating/
// comments/reviews (stored under their device-local anonymous id) to their
// new account uid. Returns the number of items migrated (0 if none).
export async function migrateAnonymousDataToVisitor(oldId: string, newId: string): Promise<number> {
  const shops = await getShopsOnce();
  const { patches, migrated } = computeAnonymousDataMigration(shops, oldId, newId);
  if (patches.length > 0) await applyShopMigrationPatches(patches);
  return migrated;
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

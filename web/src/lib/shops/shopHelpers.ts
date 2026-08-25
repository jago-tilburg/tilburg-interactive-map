import type { Shop, ShopComment, ShopUserRating, ShopUserReview, ShopMigrationPatch } from "@/types/shops";

// Firebase RTDB stores an id-keyed object; snapshot.val() returns that object
// (or, defensively, an array — RTDB coerces objects with a high fill-ratio of
// sequential integer keys into arrays, though our Date.now()-based ids never
// hit that threshold in practice). Normalize either shape to a plain list.
export function shopsSnapshotToArray(val: unknown): Shop[] {
  if (!val) return [];
  const raw = Array.isArray(val) ? val.filter(Boolean) : Object.values(val as Record<string, Shop>).filter(Boolean);
  return raw.map(normalizeShopArrays);
}

// RTDB never stores an empty array/object at a path — writing `likes: []`
// on create is equivalent to writing nothing there at all. So a shop with
// zero interactions so far comes back from a real snapshot missing
// `likes`/`comments`/`userReviews`/`userRatings` entirely, even though the
// Shop type promises they're always arrays. Normalizing here, once, is what
// makes that promise actually true for every consumer — confirmed the hard
// way: ShopDetailModal trusted the type and crashed the whole page
// (`shop.likes.includes` on undefined) opening any shop with no likes yet.
//
// Each of these four fields is stored in RTDB as a keyed object (likes:
// {userId: true}, the rest: {itemId: {...}}), not an array — keyed so
// database.rules.json can scope writes to a single $key instead of granting
// write to the whole subtree (see the shop-interactions-keyed-schema
// migration). Normalizing back to arrays here is what keeps every
// *consumer* of a Shop unaware of that storage-shape detail.
function normalizeShopArrays(shop: Shop): Shop {
  const rawLikes = shop.likes as unknown as Record<string, true> | string[] | undefined;
  return {
    ...shop,
    likes: Array.isArray(rawLikes) ? rawLikes : Object.keys(rawLikes ?? {}),
    comments: toValueArray(shop.comments),
    userReviews: toValueArray(shop.userReviews),
    userRatings: toValueArray(shop.userRatings),
  };
}

function toValueArray<T>(val: T[] | Record<string, T> | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : Object.values(val);
}

// Builds the next rating record for a user — preserves the original
// createdAt and stamps updatedAt on a change, matching what the RTDB write
// at userRatings/{userId} replaces wholesale.
export function nextUserRating(
  existing: ShopUserRating | undefined,
  userId: string,
  rating: number,
): ShopUserRating {
  if (existing) return { ...existing, userId, rating, updatedAt: Date.now() };
  return { userId, rating, createdAt: Date.now() };
}

export function averageRating(ratings: ShopUserRating[] | undefined): number | null {
  const current = ratings ?? [];
  if (current.length === 0) return null;
  const sum = current.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / current.length) * 10) / 10;
}

export function buildComment(input: { userId: string; userName: string; text: string }): ShopComment {
  return { id: Date.now(), userId: input.userId, userName: input.userName, text: input.text, createdAt: new Date().toISOString() };
}

export function buildUserReview(input: {
  userId: string;
  userName: string;
  rating: number;
  text: string;
}): ShopUserReview {
  return {
    id: Date.now(),
    userId: input.userId,
    userName: input.userName,
    rating: input.rating,
    text: input.text,
    createdAt: new Date().toISOString(),
  };
}

// Ports migrateAnonymousVisitorData from the prototype: re-tags a shop's
// likes/rating/comments/reviews from the device-local anonymous id to the
// newly signed-in visitor's uid. Likes and ratings are max. 1 per user
// (dedupe/overwrite); comments and userReviews allow several per user, so
// every one of theirs is re-tagged rather than merged. Pure/no I/O — callers
// apply the returned patches.
export function computeAnonymousDataMigration(
  shops: Shop[],
  oldId: string,
  newId: string,
): { patches: ShopMigrationPatch[]; migrated: number } {
  if (!oldId || oldId === newId) return { patches: [], migrated: 0 };

  const patches: ShopMigrationPatch[] = [];
  let migrated = 0;

  for (const shop of shops) {
    const updates: Record<string, unknown> = {};
    let changed = false;

    // Likes/ratings are keyed by userId itself, so re-tagging means moving
    // the value from the old key to the new one (a real multi-path
    // update), not patching a field in place.
    if (shop.likes?.includes(oldId)) {
      updates[`likes/${oldId}`] = null;
      if (!shop.likes.includes(newId)) updates[`likes/${newId}`] = true;
      changed = true;
      migrated++;
    }

    const oldRating = shop.userRatings?.find((r) => r.userId === oldId);
    if (oldRating) {
      updates[`userRatings/${oldId}`] = null;
      updates[`userRatings/${newId}`] = { ...oldRating, userId: newId };
      changed = true;
      migrated++;
    }

    // Comments/reviews are keyed by their own generated id, independent of
    // userId — re-tagging is an in-place field patch on each existing key,
    // not a key move.
    const ownComments = shop.comments?.filter((c) => c.userId === oldId) ?? [];
    for (const c of ownComments) updates[`comments/${c.id}/userId`] = newId;
    if (ownComments.length > 0) {
      changed = true;
      migrated += ownComments.length;
    }

    const ownReviews = shop.userReviews?.filter((r) => r.userId === oldId) ?? [];
    for (const r of ownReviews) updates[`userReviews/${r.id}/userId`] = newId;
    if (ownReviews.length > 0) {
      changed = true;
      migrated += ownReviews.length;
    }

    if (changed) patches.push({ shopId: shop.id, updates });
  }

  return { patches, migrated };
}

// 10.0 down to 1.0 in 0.1 steps — matches the shopRating/userReviewRating
// <select> population loop in the monolith exactly (i from 100 to 10).
export const RATING_SELECT_OPTIONS: string[] = Array.from({ length: 91 }, (_, i) => ((100 - i) / 10).toFixed(1));

export function ratingColor(rating: number): string {
  if (rating >= 7) return "#16a34a";
  if (rating >= 5) return "#d97706";
  return "#dc2626";
}

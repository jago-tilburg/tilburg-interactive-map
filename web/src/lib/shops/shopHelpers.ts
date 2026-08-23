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
function normalizeShopArrays(shop: Shop): Shop {
  return {
    ...shop,
    likes: shop.likes ?? [],
    comments: shop.comments ?? [],
    userReviews: shop.userReviews ?? [],
    userRatings: shop.userRatings ?? [],
  };
}

export function toggleLike(likes: string[] | undefined, userId: string): string[] {
  const current = likes ?? [];
  return current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
}

export function upsertUserRating(
  ratings: ShopUserRating[] | undefined,
  userId: string,
  rating: number,
): ShopUserRating[] {
  const current = ratings ?? [];
  const existingIndex = current.findIndex((r) => r.userId === userId);
  if (existingIndex >= 0) {
    const next = [...current];
    next[existingIndex] = { ...next[existingIndex], rating, updatedAt: Date.now() };
    return next;
  }
  return [...current, { userId, rating, createdAt: Date.now() }];
}

export function averageRating(ratings: ShopUserRating[] | undefined): number | null {
  const current = ratings ?? [];
  if (current.length === 0) return null;
  const sum = current.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / current.length) * 10) / 10;
}

export function addComment(
  comments: ShopComment[] | undefined,
  input: { userId: string; userName: string; text: string },
): ShopComment[] {
  return [
    ...(comments ?? []),
    { id: Date.now(), userId: input.userId, userName: input.userName, text: input.text, createdAt: new Date().toISOString() },
  ];
}

export function removeComment(comments: ShopComment[] | undefined, commentId: number): ShopComment[] {
  return (comments ?? []).filter((c) => c.id !== commentId);
}

export function addUserReview(
  reviews: ShopUserReview[] | undefined,
  input: { userId: string; userName: string; rating: number; text: string },
): ShopUserReview[] {
  return [
    ...(reviews ?? []),
    {
      id: Date.now(),
      userId: input.userId,
      userName: input.userName,
      rating: input.rating,
      text: input.text,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function removeUserReview(reviews: ShopUserReview[] | undefined, reviewId: number): ShopUserReview[] {
  return (reviews ?? []).filter((r) => r.id !== reviewId);
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
    const patch: ShopMigrationPatch = { shopId: shop.id };
    let changed = false;

    if (shop.likes?.includes(oldId)) {
      const withoutOld = shop.likes.filter((id) => id !== oldId);
      patch.likes = withoutOld.includes(newId) ? withoutOld : [...withoutOld, newId];
      changed = true;
      migrated++;
    }

    const oldRating = shop.userRatings?.find((r) => r.userId === oldId);
    if (oldRating) {
      patch.userRatings = [
        ...shop.userRatings.filter((r) => r.userId !== oldId && r.userId !== newId),
        { ...oldRating, userId: newId },
      ];
      changed = true;
      migrated++;
    }

    const ownComments = shop.comments?.filter((c) => c.userId === oldId) ?? [];
    if (ownComments.length > 0) {
      patch.comments = shop.comments.map((c) => (c.userId === oldId ? { ...c, userId: newId } : c));
      changed = true;
      migrated += ownComments.length;
    }

    const ownReviews = shop.userReviews?.filter((r) => r.userId === oldId) ?? [];
    if (ownReviews.length > 0) {
      patch.userReviews = shop.userReviews.map((r) => (r.userId === oldId ? { ...r, userId: newId } : r));
      changed = true;
      migrated += ownReviews.length;
    }

    if (changed) patches.push(patch);
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

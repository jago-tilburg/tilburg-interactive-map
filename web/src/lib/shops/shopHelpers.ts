import type { Shop, ShopComment, ShopUserRating, ShopUserReview } from "@/types/shops";

// Firebase RTDB stores an id-keyed object; snapshot.val() returns that object
// (or, defensively, an array — RTDB coerces objects with a high fill-ratio of
// sequential integer keys into arrays, though our Date.now()-based ids never
// hit that threshold in practice). Normalize either shape to a plain list.
export function shopsSnapshotToArray(val: unknown): Shop[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return Object.values(val as Record<string, Shop>).filter(Boolean);
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

// 10.0 down to 1.0 in 0.1 steps — matches the shopRating/userReviewRating
// <select> population loop in the monolith exactly (i from 100 to 10).
export const RATING_SELECT_OPTIONS: string[] = Array.from({ length: 91 }, (_, i) => ((100 - i) / 10).toFixed(1));

export function ratingColor(rating: number): string {
  if (rating >= 7) return "#16a34a";
  if (rating >= 5) return "#d97706";
  return "#dc2626";
}

export interface DietaryOptions {
  glutenvrij: boolean;
  halal: boolean;
  vega: boolean;
}

export interface ShopComment {
  id: number;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface ShopUserRating {
  userId: string;
  rating: number;
  createdAt: number;
  updatedAt?: number;
}

export interface ShopUserReview {
  id: number;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  createdAt: string;
}

// Stored at shops/{id} in RTDB — id-keyed, not array-index-keyed. See
// scripts/migrate-shops-to-keyed-schema.js for why.
export interface Shop {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  price: string;
  photoUrl: string;
  review: string;
  tiktokUrl: string;
  instagramUrl: string;
  dietaryOptions: DietaryOptions;
  createdAt: string;
  likes: string[];
  comments: ShopComment[];
  userReviews: ShopUserReview[];
  userRatings: ShopUserRating[];
}

export type ShopInput = Omit<
  Shop,
  "id" | "likes" | "comments" | "userReviews" | "userRatings" | "createdAt"
>;

// Per-shop delta produced by computeAnonymousDataMigration — only the
// interaction fields that actually changed for that shop are present.
export interface ShopMigrationPatch {
  shopId: number;
  likes?: string[];
  comments?: ShopComment[];
  userRatings?: ShopUserRating[];
  userReviews?: ShopUserReview[];
}

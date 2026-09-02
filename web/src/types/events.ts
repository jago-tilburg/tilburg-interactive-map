import type { Timestamp } from "firebase/firestore";

export type EventCategory = "eten" | "muziek" | "sport" | "markt" | "anders";

export interface DailyTime {
  startTime: string;
  endTime: string;
}

export interface EventPriceTier {
  label: string;
  amount: number;
}

export type BusinessEventStatus = "pending" | "approved" | "rejected" | "suspended" | "blocked";

export interface BusinessEvent {
  id: string;
  title: string;
  category: EventCategory;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  address: string;
  lat: number;
  lng: number;
  ownerId: string;
  // Fixed to "Tilburg" at creation (GO-LIVE-CHECKLIST.md §0, decided
  // 2026-09-02: Tilburg-only at launch, but store city now so a future
  // multi-city expansion is a config change, not a data migration).
  city: string;
  status: BusinessEventStatus;
  paid: boolean;
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  rejectionReason?: string;
  moderatedAt?: Timestamp;
  moderatedBy?: string;
  moderationReason?: string;
  paidAt?: Timestamp;
  multiDay?: boolean;
  dailyTimes?: Record<string, DailyTime> | null;
  umbrellaEventId?: string | null;
  photoUrl?: string;
  websiteUrl?: string;
  prices?: EventPriceTier[];
  views?: number;
  interest?: number;
  clicks?: number;
  shares?: number;
}

export type BusinessEventInput = Omit<
  BusinessEvent,
  | "id"
  | "ownerId"
  | "city"
  | "status"
  | "paid"
  | "createdAt"
  | "reviewedAt"
  | "reviewedBy"
  | "rejectionReason"
  | "moderatedAt"
  | "moderatedBy"
  | "moderationReason"
  | "paidAt"
>;

export interface UmbrellaEvent {
  id: string;
  title: string;
  description: string;
  color: string;
  photoUrl?: string;
  startDate: string;
  endDate: string;
  createdAt: Timestamp;
  // Fixed to "Tilburg" at creation (GO-LIVE-CHECKLIST.md §0, decided
  // 2026-09-02: Tilburg-only at launch, but store city now so a future
  // multi-city expansion is a config change, not a data migration).
  city: string;
}

export type UmbrellaEventInput = Omit<UmbrellaEvent, "id" | "createdAt" | "city">;

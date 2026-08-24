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

export type BusinessEventStatus = "pending" | "approved" | "rejected";

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
  status: BusinessEventStatus;
  paid: boolean;
  createdAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  rejectionReason?: string;
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
}

export type BusinessEventInput = Omit<
  BusinessEvent,
  | "id"
  | "ownerId"
  | "status"
  | "paid"
  | "createdAt"
  | "reviewedAt"
  | "reviewedBy"
  | "rejectionReason"
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
}

export type UmbrellaEventInput = Omit<UmbrellaEvent, "id" | "createdAt">;

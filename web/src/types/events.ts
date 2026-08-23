import type { Timestamp } from "firebase/firestore";

export type EventCategory = "eten" | "muziek" | "sport" | "markt" | "anders";

export interface DailyTime {
  startTime: string;
  endTime: string;
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
  paidAt?: Timestamp;
  multiDay?: boolean;
  dailyTimes?: Record<string, DailyTime> | null;
  umbrellaEventId?: string | null;
}

export type BusinessEventInput = Omit<
  BusinessEvent,
  "id" | "ownerId" | "status" | "paid" | "createdAt" | "reviewedAt" | "reviewedBy" | "paidAt"
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

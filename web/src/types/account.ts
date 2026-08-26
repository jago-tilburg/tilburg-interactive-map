import type { Timestamp } from "firebase/firestore";

export interface Visitor {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
  savedEventIds?: string[];
  // Marketing consent, asked once at onboarding (PLAN-INLOGGEN.md §8). Absent
  // until the onboarding step completes; `marketingConsentAt` is the signal
  // for "has this account finished onboarding", not the boolean itself —
  // false is a valid, deliberate answer.
  marketingConsent?: boolean;
  marketingConsentAt?: Timestamp;
  marketingConsentSource?: "signup" | "profile";
}

export interface Business {
  uid: string;
  businessName: string;
  email: string;
  createdAt: Timestamp;
  // Prefills a new event's location fields — set from the Settings tab, not
  // retroactively applied to already-submitted events (matches the
  // prototype's saveDashboardSettings(), which only cascades businessName
  // onto owned events, never the address).
  defaultAddress?: string;
  defaultLat?: number;
  defaultLng?: number;
}

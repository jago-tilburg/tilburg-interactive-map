import type { Timestamp } from "firebase/firestore";

export interface Visitor {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
}

export interface Business {
  uid: string;
  businessName: string;
  email: string;
  createdAt: Timestamp;
}

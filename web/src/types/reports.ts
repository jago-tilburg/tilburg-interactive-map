import type { Timestamp } from "firebase/firestore";

// shopPhoto/eventPhoto included for forward-compatibility with the planned
// photo upload pipeline (not built yet — no UI reports these two today).
export type ReportContentType = "shop" | "businessEvent" | "comment" | "review" | "shopPhoto" | "eventPhoto";

export type ReportReason = "spam" | "offensive" | "incorrect_info" | "other";

export type ReportStatus = "open" | "resolved" | "dismissed";

export interface Report {
  id: string;
  contentType: ReportContentType;
  contentId: string;
  // For a comment/review report, the shop/event it belongs to — lets admin
  // jump straight to the right place. Not needed when contentType IS the
  // top-level shop/event, since contentId already is that id.
  parentId?: string;
  reporterId: string;
  reason: ReportReason;
  details?: string;
  createdAt: Timestamp;
  status: ReportStatus;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
}

export type ReportInput = Pick<Report, "contentType" | "contentId" | "reason"> &
  Partial<Pick<Report, "parentId" | "details">>;

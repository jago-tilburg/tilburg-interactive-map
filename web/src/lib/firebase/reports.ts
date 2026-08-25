import { collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from "firebase/firestore";
import { getDb } from "./firestore";
import type { Report, ReportInput } from "@/types/reports";

function fromSnapshot(snap: { docs: Array<{ id: string; data: () => unknown }> }): Report[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Report[];
}

// Deterministic id, not addDoc()'s auto-generated one — a reporter
// re-filing on the same content overwrites their own prior entry (reopening
// it if it had been resolved/dismissed) instead of piling up duplicates,
// while distinct reporters on the same content each still get their own
// doc. Firestore rules key off this same shape (see firestore.rules).
export async function createReport(reporterId: string, input: ReportInput) {
  const reportId = `${input.contentType}_${input.contentId}_${reporterId}`;
  return setDoc(doc(getDb(), "reports", reportId), {
    ...input,
    reporterId,
    createdAt: serverTimestamp(),
    status: "open",
  });
}

export function subscribeAllReportsForAdmin(
  onChange: (reports: Report[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "reports"),
    (snap) => onChange(fromSnapshot(snap)),
    (error) => onError?.(error),
  );
}

export async function resolveReport(reportId: string, adminUid: string) {
  return updateDoc(doc(getDb(), "reports", reportId), {
    status: "resolved",
    resolvedAt: serverTimestamp(),
    resolvedBy: adminUid,
  });
}

export async function dismissReport(reportId: string, adminUid: string) {
  return updateDoc(doc(getDb(), "reports", reportId), {
    status: "dismissed",
    resolvedAt: serverTimestamp(),
    resolvedBy: adminUid,
  });
}

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firestore";
import type { BusinessEvent, BusinessEventInput } from "@/types/events";

function fromSnapshot(snap: { docs: Array<{ id: string; data: () => unknown }> }): BusinessEvent[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as BusinessEvent[];
}

export function subscribeApprovedBusinessEvents(
  onChange: (events: BusinessEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(getDb(), "businessEvents"), where("status", "==", "approved"));
  return onSnapshot(
    q,
    (snap) => onChange(fromSnapshot(snap)),
    (error) => onError?.(error),
  );
}

export function subscribeMyBusinessEvents(
  uid: string,
  onChange: (events: BusinessEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(getDb(), "businessEvents"), where("ownerId", "==", uid));
  return onSnapshot(
    q,
    (snap) => onChange(fromSnapshot(snap)),
    (error) => onError?.(error),
  );
}

export function subscribeAllBusinessEventsForAdmin(
  onChange: (events: BusinessEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "businessEvents"),
    (snap) => onChange(fromSnapshot(snap)),
    (error) => onError?.(error),
  );
}

export async function createBusinessEvent(ownerId: string, input: BusinessEventInput) {
  return addDoc(collection(getDb(), "businessEvents"), {
    ...input,
    ownerId,
    status: "pending",
    paid: false,
    createdAt: serverTimestamp(),
  });
}

// Mirrors the original app's rule: editing title/dates/location on an
// already-approved event pulls it back to 'pending' for re-review — the one
// client-driven status transition the Firestore rules allow.
export async function updateBusinessEvent(
  eventId: string,
  input: BusinessEventInput,
  options: { pullBackToPending: boolean },
) {
  const patch: Record<string, unknown> = { ...input };
  if (options.pullBackToPending) {
    patch.status = "pending";
  }
  return updateDoc(doc(getDb(), "businessEvents", eventId), patch);
}

export async function deleteBusinessEvent(eventId: string) {
  return deleteDoc(doc(getDb(), "businessEvents", eventId));
}

// Public engagement counters — open to any visitor (including
// unauthenticated) on an approved event; see the `businessEvents` update
// rule's counter-bump branch in firestore.rules.
export async function trackEventView(eventId: string) {
  return updateDoc(doc(getDb(), "businessEvents", eventId), { views: increment(1) });
}

export async function incrementEventInterest(eventId: string) {
  return updateDoc(doc(getDb(), "businessEvents", eventId), { interest: increment(1) });
}

export async function incrementEventClicks(eventId: string) {
  return updateDoc(doc(getDb(), "businessEvents", eventId), { clicks: increment(1) });
}

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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

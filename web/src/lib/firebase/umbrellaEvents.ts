import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firestore";
import type { UmbrellaEvent, UmbrellaEventInput } from "@/types/events";

export function subscribeUmbrellaEvents(
  onChange: (events: UmbrellaEvent[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "umbrellaEvents"),
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as UmbrellaEvent[]),
    (error) => onError?.(error),
  );
}

export async function createUmbrellaEvent(input: UmbrellaEventInput) {
  return addDoc(collection(getDb(), "umbrellaEvents"), { ...input, createdAt: serverTimestamp() });
}

export async function updateUmbrellaEvent(umbrellaId: string, input: UmbrellaEventInput) {
  return updateDoc(doc(getDb(), "umbrellaEvents", umbrellaId), { ...input });
}

export async function deleteUmbrellaEvent(umbrellaId: string) {
  return deleteDoc(doc(getDb(), "umbrellaEvents", umbrellaId));
}

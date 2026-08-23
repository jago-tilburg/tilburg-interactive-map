import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  collection,
  query,
  where,
  getDocs,
  type Firestore,
} from "firebase/firestore";
import { getFirebaseApp } from "./app";
import type { Visitor, Business } from "@/types/account";

export function getDb(): Firestore {
  return getFirestore(getFirebaseApp());
}

export async function getVisitorProfile(uid: string): Promise<Visitor | null> {
  const snap = await getDoc(doc(getDb(), "visitors", uid));
  return snap.exists() ? ({ uid, ...snap.data() } as Visitor) : null;
}

// createdAt uses serverTimestamp() instead of the monolith's Date.now() —
// deliberate improvement, but callers must treat it as a Firestore Timestamp,
// not a number.
export async function createVisitorProfile(uid: string, email: string): Promise<Visitor> {
  const profile = {
    email,
    displayName: (email || "Bezoeker").split("@")[0],
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(getDb(), "visitors", uid), profile);
  return { uid, ...profile } as Visitor;
}

export async function deleteVisitorProfile(uid: string) {
  return deleteDoc(doc(getDb(), "visitors", uid));
}

export async function getBusinessProfile(uid: string): Promise<Business | null> {
  const snap = await getDoc(doc(getDb(), "businesses", uid));
  return snap.exists() ? ({ uid, ...snap.data() } as Business) : null;
}

export async function createBusinessProfile(
  uid: string,
  businessName: string,
  email: string,
): Promise<Business> {
  const profile = { businessName, email, createdAt: serverTimestamp() };
  await setDoc(doc(getDb(), "businesses", uid), profile);
  return { uid, ...profile } as Business;
}

// Batch-deletes the business's businessEvents via a query rather than relying
// on an already-subscribed listener (as the monolith did) — more correct,
// doesn't silently miss events the listener hadn't loaded yet.
export async function deleteBusinessAccountCascade(uid: string) {
  const db = getDb();
  const eventsSnap = await getDocs(
    query(collection(db, "businessEvents"), where("ownerId", "==", uid)),
  );
  const batch = writeBatch(db);
  eventsSnap.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "businesses", uid));
  await batch.commit();
}

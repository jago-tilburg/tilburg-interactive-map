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
  updateDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
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

// Live view of a visitor's own profile — separate from the one-time
// getVisitorProfile() read the auth hook uses, so screens like the
// dashboard reflect a savedEventIds change immediately instead of waiting
// for the next auth-state refresh.
export function subscribeVisitorProfile(
  uid: string,
  onChange: (visitor: Visitor | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "visitors", uid),
    (snap) => onChange(snap.exists() ? ({ uid, ...snap.data() } as Visitor) : null),
    (error) => onError?.(error),
  );
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

export async function updateVisitorDisplayName(uid: string, displayName: string) {
  return updateDoc(doc(getDb(), "visitors", uid), { displayName });
}

// The onboarding step (PLAN-INLOGGEN.md §8) — sets the name and the FIRST
// marketing-consent decision together. marketingConsentAt (not the boolean
// itself) is what useAuth's needsOnboarding reads, so this is also what
// marks onboarding as done, even when consent is left unchecked.
export async function saveOnboardingConsent(uid: string, displayName: string, marketingConsent: boolean) {
  return updateDoc(doc(getDb(), "visitors", uid), {
    displayName,
    marketingConsent,
    marketingConsentAt: serverTimestamp(),
    marketingConsentSource: "signup",
  });
}

// The profile-tab toggle, after onboarding — same shape, different source,
// so a later complaint can be traced to where the decision was made.
export async function updateMarketingConsent(uid: string, marketingConsent: boolean) {
  return updateDoc(doc(getDb(), "visitors", uid), {
    marketingConsent,
    marketingConsentAt: serverTimestamp(),
    marketingConsentSource: "profile",
  });
}

// Saved/favorited business events — a plain array field on the visitor's own
// profile doc, not a subcollection, since the existing owner-only
// `visitors/{uid}` update rule already covers arbitrary field writes with no
// extra rules needed.
export async function setEventSaved(uid: string, eventId: string, saved: boolean) {
  return updateDoc(doc(getDb(), "visitors", uid), {
    savedEventIds: saved ? arrayUnion(eventId) : arrayRemove(eventId),
  });
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

// Settings-tab self-update — the businesses/{uid} rule already allows a
// business to update any field on its own doc, so no rules change is needed.
export async function updateBusinessProfile(
  uid: string,
  updates: Partial<Pick<Business, "businessName" | "defaultAddress" | "defaultLat" | "defaultLng">>,
) {
  return updateDoc(doc(getDb(), "businesses", uid), updates);
}

// Deletes only the business side of an account: owned businessEvents
// (batch-deleted via a query rather than relying on an already-subscribed
// listener, as the monolith did — more correct, doesn't silently miss
// events the listener hadn't loaded yet) plus the businesses/{uid} doc
// itself. Leaves the visitor profile (the account itself) untouched —
// giving up the event-owner role isn't the same as closing the account
// (PLAN-INLOGGEN.md §9).
export async function deleteBusinessProfileCascade(uid: string) {
  const db = getDb();
  const eventsSnap = await getDocs(
    query(collection(db, "businessEvents"), where("ownerId", "==", uid)),
  );
  const batch = writeBatch(db);
  eventsSnap.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "businesses", uid));
  await batch.commit();
}

// Closes the whole account: the business side (if any) plus the visitor
// profile itself. The Auth user is deleted separately, last, by the caller
// (see deleteCurrentUser's own doc comment for why).
export async function deleteAccountCascade(uid: string) {
  const biz = await getBusinessProfile(uid);
  if (biz) await deleteBusinessProfileCascade(uid);
  await deleteVisitorProfile(uid);
}

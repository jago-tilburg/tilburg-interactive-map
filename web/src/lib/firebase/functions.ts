import { getFunctions, httpsCallable, type Functions } from "firebase/functions";
import { getFirebaseApp } from "./app";

const REGION = "europe-west1";

export function getFirebaseFunctions(): Functions {
  return getFunctions(getFirebaseApp(), REGION);
}

// Returns the Stripe Checkout Session URL to redirect the browser to — the
// event isn't actually marked paid until Stripe's webhook confirms the
// payment server-side (see functions/index.js's stripeWebhook), not on
// return from this call.
export async function createCheckoutSession(eventId: string): Promise<string> {
  const callable = httpsCallable<{ eventId: string }, { url: string }>(
    getFirebaseFunctions(),
    "createCheckoutSession",
  );
  const result = await callable({ eventId });
  return result.data.url;
}

export async function suspendEvent(eventId: string, reason?: string) {
  const callable = httpsCallable(getFirebaseFunctions(), "suspendEvent");
  return callable({ eventId, reason });
}

export async function restoreEvent(eventId: string) {
  const callable = httpsCallable(getFirebaseFunctions(), "restoreEvent");
  return callable({ eventId });
}

export async function blockEvent(eventId: string, reason?: string) {
  const callable = httpsCallable(getFirebaseFunctions(), "blockEvent");
  return callable({ eventId, reason });
}

// Named distinctly from businessEvents.ts's deleteBusinessEvent (an
// owner-only direct Firestore delete) — this goes through the admin-gated
// deleteEvent Cloud Function instead, since Firestore rules only grant
// delete to an event's own owner, not to admins moderating someone else's.
export async function adminDeleteEvent(eventId: string) {
  const callable = httpsCallable(getFirebaseFunctions(), "deleteEvent");
  return callable({ eventId });
}

import { getFunctions, httpsCallable, type Functions } from "firebase/functions";
import { getFirebaseApp } from "./app";

const REGION = "europe-west1";

export function getFirebaseFunctions(): Functions {
  return getFunctions(getFirebaseApp(), REGION);
}

export async function approveEvent(eventId: string) {
  const callable = httpsCallable(getFirebaseFunctions(), "approveEvent");
  return callable({ eventId });
}

export async function rejectEvent(eventId: string, reason?: string) {
  const callable = httpsCallable(getFirebaseFunctions(), "rejectEvent");
  return callable({ eventId, reason });
}

export async function confirmEventPaymentStub(eventId: string) {
  const callable = httpsCallable(getFirebaseFunctions(), "confirmEventPaymentStub");
  return callable({ eventId });
}

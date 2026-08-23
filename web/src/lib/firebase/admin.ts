import { doc, getDoc } from "firebase/firestore";
import { getDb } from "./firestore";

// Replaces the monolith's RTDB adminUsers array-membership check
// (loadAdminUids/checkAdminStatus) with a single admins/{uid} doc-existence
// read against the closed Firestore collection.
export async function isUidAdmin(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(getDb(), "admins", uid));
  return snap.exists();
}

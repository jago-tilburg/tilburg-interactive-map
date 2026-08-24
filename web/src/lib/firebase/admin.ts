import { ref, get } from "firebase/database";
import { getRtdb } from "./database";

// SECURITY/CORRECTNESS FIX (2026-08-25, found via a live pen-test): this
// used to read Firestore admins/{uid} directly — but that collection's rule
// is `allow read, write: if false`, unconditionally, for EVERYONE including
// the admin's own uid (by design: it exists only for other rules' exists()
// checks and Cloud Functions' Admin-SDK-bypassing requireAdmin(), never for
// direct client reads — see the rule's own comment in firestore.rules).
// That Firestore read could therefore never succeed for any caller, ever,
// and the unguarded `await` in useAuth.tsx's auth-state callback meant this
// function throwing silently broke sign-in for EVERY account type (visitor,
// business, admin alike) on the real deployed site — confirmed live: a real
// business registration completed in Firebase Auth but the app never
// reflected it, "Missing or insufficient permissions" in the console.
//
// Firestore admins/{uid} remains the real, authoritative, server-only
// source (Cloud Functions + rules' exists() checks) — do not make it
// client-readable. For the client-side "is this signed-in user an admin"
// UI flag, read the RTDB adminUsers array instead: it's already the
// public-read mirror the legacy RTDB rules use for the same purpose
// (database.rules.json's `"adminUsers": {".read": true}`), and is already
// kept in sync with Firestore admins/{uid} for the existing admin account.
// Whoever seeds a new admin must add them to BOTH — this only reads the
// RTDB side.
export async function isUidAdmin(uid: string): Promise<boolean> {
  const snap = await get(ref(getRtdb(), "adminUsers"));
  const admins = snap.val();
  return Array.isArray(admins) ? admins.includes(uid) : !!admins?.[uid];
}

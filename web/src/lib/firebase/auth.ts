import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
  type User,
  type Auth,
  type UserCredential,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { getFirebaseApp } from "./app";
import { getFirebaseFunctions } from "./functions";

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function subscribeToAuthState(cb: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}

export async function signInWithPassword(email: string, password: string) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function registerWithPassword(email: string, password: string) {
  return createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
}

// Popup first, per PLAN-INLOGGEN.md §7 — a full-page redirect is only a
// fallback for when the popup itself can't be shown (blocked, or the
// environment doesn't support it at all), not for a user who deliberately
// closed it. On redirect, this resolves with `null`: the real result lands
// later via getGoogleRedirectResult(), called once on load by useAuth.
export async function signInWithGoogle(): Promise<UserCredential | null> {
  const provider = new GoogleAuthProvider();
  try {
    return await signInWithPopup(getFirebaseAuth(), provider);
  } catch (err) {
    const code = (err as { code?: string })?.code ?? "";
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(getFirebaseAuth(), provider);
      return null;
    }
    throw err;
  }
}

// Picks up a sign-in that finished via the signInWithRedirect() fallback
// above — resolves to null on a plain page load with no pending redirect.
export async function getGoogleRedirectResult() {
  return getRedirectResult(getFirebaseAuth());
}

// Distinguishes a brand-new Google sign-up from a returning Google user —
// only the former needs a fresh visitor profile explicitly created (and the
// auth listener's own auto-create suppressed meanwhile, see useAuth.tsx).
export function isNewGoogleUser(cred: UserCredential): boolean {
  return getAdditionalUserInfo(cred)?.isNewUser ?? false;
}

// Both of these now go through our own branded Resend template
// (functions/emails/base.html) instead of Firebase Auth's own default
// sender — see functions/index.js's sendPasswordResetEmail/
// sendVerificationEmail.
export async function sendPasswordReset(email: string) {
  const callable = httpsCallable(getFirebaseFunctions(), "sendPasswordResetEmail");
  await callable({ email });
}

// No `user` argument needed — the callable reads the caller's own uid off
// their ID token rather than trusting anything the client passes in.
export async function sendVerificationEmail() {
  const callable = httpsCallable(getFirebaseFunctions(), "sendVerificationEmail");
  await callable({});
}

// `user.reload()` mutates the User object in place but does NOT itself
// trigger a React re-render — callers must follow this with their own state
// update (see useAuth's `emailVerified` state and PLAN-INLOGGEN.md §3's
// "valkuil").
export async function reloadCurrentUser(user: User) {
  return user.reload();
}

export async function signOutCurrentUser() {
  return signOut(getFirebaseAuth());
}

// Deletes the Auth user itself — callers delete the Firestore profile(s)
// (deleteAccountCascade / deleteBusinessProfileCascade) first, since that
// still has an authenticated uid to work with, then call this last. Can
// throw `auth/requires-recent-login` if the session is stale; callers
// should surface that to the user rather than swallow it.
export async function deleteCurrentUser(user: User) {
  return deleteUser(user);
}

// Firebase Auth requires a recent login for a sensitive change like a
// password update — reauthenticate with the current password first (throws
// `auth/wrong-password`/`auth/invalid-credential` if it's wrong), same
// pattern deleteCurrentUser's callers already work around for its own
// requires-recent-login case. A password hangs off the account, not off a
// role, so this lives in the visitor profile now (PLAN-INLOGGEN.md §9).
export async function changeAccountPassword(user: User, currentPassword: string, newPassword: string) {
  const credential = EmailAuthProvider.credential(user.email ?? "", currentPassword);
  await reauthenticateWithCredential(user, credential);
  return updatePassword(user, newPassword);
}

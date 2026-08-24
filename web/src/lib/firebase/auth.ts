import {
  getAuth,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  type User,
  type Auth,
} from "firebase/auth";
import { getFirebaseApp } from "./app";

export const VISITOR_AUTH_EMAIL_KEY = "tilburg-visitor-pending-email";

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

export function subscribeToAuthState(cb: (user: User | null) => void) {
  return onAuthStateChanged(getFirebaseAuth(), cb);
}

export function visitorActionCodeSettings() {
  return {
    url: window.location.origin + window.location.pathname,
    handleCodeInApp: true,
  };
}

export async function sendVisitorMagicLink(email: string) {
  return sendSignInLinkToEmail(getFirebaseAuth(), email, visitorActionCodeSettings());
}

export function isVisitorMagicLink(href: string) {
  return isSignInWithEmailLink(getFirebaseAuth(), href);
}

export async function completeVisitorMagicLink(email: string, href: string) {
  return signInWithEmailLink(getFirebaseAuth(), email, href);
}

export async function loginBusiness(email: string, password: string) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function registerBusiness(email: string, password: string) {
  return createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
}

// Admin login uses the same Auth instance/flow as business login — admin-ness
// is resolved post-login by Firestore admins/{uid} membership, not a separate
// account type. Mirrors the monolith's adminInloggen().
export async function loginAdmin(email: string, password: string) {
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function signOutCurrentUser() {
  return signOut(getFirebaseAuth());
}

// Deletes the Auth user itself — callers delete the Firestore profile
// (deleteVisitorProfile / deleteBusinessAccountCascade) first, since that
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
// requires-recent-login case.
export async function changeBusinessPassword(user: User, currentPassword: string, newPassword: string) {
  const credential = EmailAuthProvider.credential(user.email ?? "", currentPassword);
  await reauthenticateWithCredential(user, credential);
  return updatePassword(user, newPassword);
}

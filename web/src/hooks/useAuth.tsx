"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { subscribeToAuthState, getGoogleRedirectResult, reloadCurrentUser } from "@/lib/firebase/auth";
import {
  getVisitorProfile,
  createVisitorProfile,
  getBusinessProfile,
} from "@/lib/firebase/firestore";
import { isUidAdmin } from "@/lib/firebase/admin";
import { migrateAnonymousDataToVisitor } from "@/lib/firebase/shops";
import { getAnonUserId } from "@/lib/shops/anonUserId";
import { useToast } from "@/hooks/useToast";
import type { Visitor, Business } from "@/types/account";

interface AuthState {
  currentUser: User | null;
  isAdmin: boolean;
  currentVisitor: Visitor | null;
  currentBusiness: Business | null;
  // Own state rather than reading currentUser.emailVerified directly — that
  // field only updates in place after an explicit reload(), which doesn't
  // itself trigger a React re-render (PLAN-INLOGGEN.md §3's "valkuil").
  emailVerified: boolean;
  // Returns the freshly-reloaded value directly — callers that need to
  // react to the result (e.g. "still not verified, check your inbox")
  // can't rely on reading `emailVerified` in the same tick, since the
  // state update above it hasn't committed yet.
  refreshEmailVerified: () => Promise<boolean>;
  // Re-fetches the signed-in business's own profile doc — currentBusiness is
  // a one-time read (not a live subscription), so a Settings-tab save needs
  // this to make the update visible without a full re-login.
  refreshCurrentBusiness: (uid?: string) => Promise<void>;
  // Same idea for the visitor profile — used right after registration
  // (before the auth-state listener's own read would resolve) and after the
  // onboarding step writes marketingConsent/displayName.
  refreshCurrentVisitor: (uid?: string) => Promise<void>;
  // True once a visitor profile exists but hasn't finished onboarding yet —
  // keyed on marketingConsentAt (not the marketingConsent boolean itself,
  // which is a legitimate `false`). False while signed out or still loading.
  needsOnboarding: boolean;
  loading: boolean;
  // Registration/Google sign-in flows set this before writing their own
  // profile doc, and reset it in `finally`, so the auth-state listener below
  // doesn't race a fresh account's profile write. Mirrors the monolith's
  // module-level suppressAutoProfileLoadRef flag.
  suppressAutoProfileLoadRef: MutableRefObject<boolean>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentVisitor, setCurrentVisitor] = useState<Visitor | null>(null);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const suppressAutoProfileLoadRef = useRef(false);
  const { showToast } = useToast();

  // Picks up a Google sign-in that finished via the signInWithRedirect()
  // fallback (popup blocked) — runs once, before the auth-state listener's
  // first resolution matters. A failure here (e.g.
  // auth/account-exists-with-different-credential) has nowhere else to
  // surface, since the redirect navigated the whole page away and back.
  useEffect(() => {
    getGoogleRedirectResult().catch((err) => {
      console.error("Google redirect sign-in error:", err);
      showToast("Inloggen met Google is mislukt.", "error");
    });
  }, [showToast]);

  useEffect(() => {
    const unsub = subscribeToAuthState(async (user) => {
      setCurrentUser(user);
      setEmailVerified(user?.emailVerified ?? false);

      if (!user) {
        setIsAdmin(false);
        setCurrentVisitor(null);
        setCurrentBusiness(null);
        setLoading(false);
        return;
      }

      // Never let a failed admin check block sign-in for everyone else —
      // this exact `await` with no guard is what silently broke the whole
      // sign-in flow before isUidAdmin() was fixed to read a source it can
      // actually access (see admin.ts's comment for the full story).
      const admin = await isUidAdmin(user.uid).catch(() => false);
      setIsAdmin(admin);

      if (suppressAutoProfileLoadRef.current) {
        setLoading(false);
        return;
      }

      // Additive, not exclusive (PLAN-INLOGGEN.md §2/§6): an account can be
      // admin AND business AND visitor at once. Everyone who signs in gets a
      // visitor profile — that profile IS the account.
      const [biz, existingVisitor] = await Promise.all([
        getBusinessProfile(user.uid),
        getVisitorProfile(user.uid),
      ]);
      setCurrentBusiness(biz);

      const visitor = existingVisitor ?? (await createVisitorProfile(user.uid, user.email ?? ""));
      try {
        const anonId = getAnonUserId();
        const migrated = await migrateAnonymousDataToVisitor(anonId, user.uid);
        if (migrated > 0) {
          showToast(`${migrated} eerdere like(s)/beoordeling(en) gekoppeld aan je account.`, "info");
        }
      } catch (err) {
        console.error("Anonymous data migration error:", err);
      }
      setCurrentVisitor(visitor);
      setLoading(false);
    });
    return () => unsub();
  }, [showToast]);

  // Accepts an explicit uid so callers right after registration (where
  // `currentUser` in this context may not have propagated from the
  // auth-state listener yet — that's an async React state update racing
  // this call) don't silently no-op. Settings-tab-style callers (already
  // fully signed in, currentUser definitely set) can omit it.
  async function refreshCurrentBusiness(uid?: string) {
    const targetUid = uid ?? currentUser?.uid;
    if (!targetUid) return;
    const biz = await getBusinessProfile(targetUid);
    setCurrentBusiness(biz);
  }

  async function refreshCurrentVisitor(uid?: string) {
    const targetUid = uid ?? currentUser?.uid;
    if (!targetUid) return;
    const visitor = await getVisitorProfile(targetUid);
    setCurrentVisitor(visitor);
  }

  async function refreshEmailVerified(): Promise<boolean> {
    if (!currentUser) return false;
    await reloadCurrentUser(currentUser);
    setEmailVerified(currentUser.emailVerified);
    return currentUser.emailVerified;
  }

  const needsOnboarding = !loading && !!currentVisitor && currentVisitor.marketingConsentAt === undefined;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        currentVisitor,
        currentBusiness,
        emailVerified,
        refreshEmailVerified,
        refreshCurrentBusiness,
        refreshCurrentVisitor,
        needsOnboarding,
        loading,
        suppressAutoProfileLoadRef,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

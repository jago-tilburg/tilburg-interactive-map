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
import {
  subscribeToAuthState,
  isVisitorMagicLink,
  completeVisitorMagicLink,
  VISITOR_AUTH_EMAIL_KEY,
} from "@/lib/firebase/auth";
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
  // Re-fetches the signed-in business's own profile doc — currentBusiness is
  // a one-time read (not a live subscription), so a Settings-tab save needs
  // this to make the update visible without a full re-login.
  refreshCurrentBusiness: () => Promise<void>;
  loading: boolean;
  // Registration flows set this before writing their own profile doc, and
  // reset it in `finally`, so the auth-state listener below doesn't race a
  // fresh registration's profile write. Mirrors the monolith's module-level
  // `suppressAutoProfileLoadRef` flag.
  suppressAutoProfileLoadRef: MutableRefObject<boolean>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentVisitor, setCurrentVisitor] = useState<Visitor | null>(null);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const suppressAutoProfileLoadRef = useRef(false);
  const { showToast } = useToast();

  // Magic-link completion-on-load — runs once, before the auth-state
  // listener's first resolution matters. Mirrors
  // completeVisitorMagicLinkIfPresent() running ahead of onAuthStateChanged
  // being wired up in the monolith.
  useEffect(() => {
    (async () => {
      /* v8 ignore next -- SSR guard; jsdom always provides `window` under test, so this branch is untestable outside a real server render. */
      if (typeof window === "undefined") return;
      if (!isVisitorMagicLink(window.location.href)) return;
      let email = window.localStorage.getItem(VISITOR_AUTH_EMAIL_KEY);
      if (!email) email = window.prompt("Bevestig je e-mailadres om in te loggen:");
      if (!email) return;
      try {
        await completeVisitorMagicLink(email, window.location.href);
        window.localStorage.removeItem(VISITOR_AUTH_EMAIL_KEY);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        console.error("Sign-in link error:", err);
      }
    })();
  }, []);

  useEffect(() => {
    const unsub = subscribeToAuthState(async (user) => {
      setCurrentUser(user);

      if (!user) {
        setIsAdmin(false);
        setCurrentVisitor(null);
        setCurrentBusiness(null);
        setLoading(false);
        return;
      }

      const admin = await isUidAdmin(user.uid);
      setIsAdmin(admin);

      if (admin) {
        setCurrentVisitor(null);
        setCurrentBusiness(null);
        setLoading(false);
        return;
      }

      if (suppressAutoProfileLoadRef.current) {
        setLoading(false);
        return;
      }

      const biz = await getBusinessProfile(user.uid);
      if (biz) {
        setCurrentBusiness(biz);
        setCurrentVisitor(null);
      } else {
        const visitor =
          (await getVisitorProfile(user.uid)) ??
          (await createVisitorProfile(user.uid, user.email ?? ""));
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
        setCurrentBusiness(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [showToast]);

  async function refreshCurrentBusiness() {
    if (!currentUser) return;
    const biz = await getBusinessProfile(currentUser.uid);
    setCurrentBusiness(biz);
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin,
        currentVisitor,
        currentBusiness,
        refreshCurrentBusiness,
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

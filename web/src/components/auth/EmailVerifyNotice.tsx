"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { sendVerificationEmail } from "@/lib/firebase/auth";
import styles from "./EmailVerifyNotice.module.css";

const RESEND_COOLDOWN_S = 60;
const DISMISS_KEY = "tilburg-email-verify-dismissed";

// No real external subscription needed — the dismissed flag, once read,
// doesn't change from outside this component during its lifetime — same
// pattern as CookieBanner.tsx's own sessionStorage/localStorage read.
function subscribeToNothing() {
  return () => {};
}

function readDismissed() {
  return window.sessionStorage.getItem(DISMISS_KEY) === "1";
}

// Two places render this (PLAN-INLOGGEN.md §8): under the header on the map,
// and above the tabs on /bedrijf. Invisible for Google users (always
// verified) and signed-out visitors — the `emailVerified` it reads is
// useAuth's own state, not currentUser.emailVerified directly, since that
// field only updates after an explicit reload() (see auth.ts's doc comment
// on reloadCurrentUser — the "valkuil" from §3).
export function EmailVerifyNotice() {
  const { currentUser, currentVisitor, emailVerified, refreshEmailVerified } = useAuth();
  const { showToast } = useToast();
  // sessionStorage, not localStorage — dismissing hides it for the rest of
  // THIS session only; it must come back next time the app opens, or it
  // stops being a reminder (PLAN-INLOGGEN.md §8). Renders as "not dismissed"
  // for the server pass and the initial client (pre-hydration) pass to
  // avoid a hydration mismatch, then swaps to the real sessionStorage value
  // after mount — same approach as CookieBanner.tsx.
  const storedDismissed = useSyncExternalStore(
    subscribeToNothing,
    readDismissed,
    /* v8 ignore next -- getServerSnapshot only runs during an actual server render or the
       initial hydration pass; RTL's render() does neither, so this is never invoked here. */
    () => false,
  );
  const [justDismissed, setJustDismissed] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  // Verifying happens in the user's mailbox, outside this app entirely —
  // this is what actually picks up a confirmation made while the tab was in
  // the background, without requiring the "Ik heb het bevestigd" click.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") refreshEmailVerified();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [refreshEmailVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const visible = !!currentUser && !!currentVisitor && !emailVerified && !storedDismissed && !justDismissed;
  if (!visible) return null;

  async function handleConfirmed() {
    setChecking(true);
    try {
      const verified = await refreshEmailVerified();
      if (!verified) showToast("Nog niet bevestigd. Check je inbox.", "info");
    } finally {
      setChecking(false);
    }
  }

  async function handleResend() {
    if (!currentUser || cooldown > 0) return;
    setResending(true);
    try {
      await sendVerificationEmail(currentUser);
      setCooldown(RESEND_COOLDOWN_S);
      showToast("Verificatiemail opnieuw verstuurd.", "success");
    } catch {
      // Firebase itself already throttles sendEmailVerification — a failure
      // here is usually that, not something the user can act on beyond
      // waiting for the cooldown that's already showing.
      showToast("Versturen mislukt. Probeer het later opnieuw.", "error");
    } finally {
      setResending(false);
    }
  }

  function handleDismiss() {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
    setJustDismissed(true);
  }

  return (
    <div className={styles.notice} role="status">
      <span className={styles.icon} aria-hidden="true">
        ✉
      </span>
      <div className={styles.text}>
        <p className={styles.title}>Bevestig je e-mailadres</p>
        <p className={styles.subtitle}>We hebben een link gestuurd naar {currentUser?.email}</p>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={handleConfirmed} disabled={checking}>
          Ik heb het bevestigd
        </button>
        <button type="button" onClick={handleResend} disabled={resending || cooldown > 0}>
          {cooldown > 0 ? `Opnieuw versturen (${cooldown}s)` : "Opnieuw versturen"}
        </button>
      </div>
      <button type="button" className={styles.dismissButton} aria-label="Sluiten" onClick={handleDismiss}>
        ✕
      </button>
    </div>
  );
}

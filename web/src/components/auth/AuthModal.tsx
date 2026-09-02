"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import {
  signInWithPassword,
  registerWithPassword,
  signInWithGoogle,
  sendPasswordReset,
  sendVerificationEmail,
  isNewGoogleUser,
} from "@/lib/firebase/auth";
import { getVisitorProfile, createVisitorProfile } from "@/lib/firebase/firestore";
import type { Visitor } from "@/types/account";
import styles from "./AuthModal.module.css";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  // Fired once a sign-in/registration is fully resolved — the caller (the
  // account menu) decides whether to route into onboarding or the chooser
  // screen from `visitor.marketingConsentAt` (PLAN-INLOGGEN.md §8), so this
  // hands back the definitive profile rather than making the caller re-read
  // it from context (which may not have propagated yet — see the
  // suppressAutoProfileLoadRef comment on useAuth.tsx).
  onAuthenticated: (visitor: Visitor) => void;
}

type Step = "login" | "register" | "forgot";

// Exported so PLAN-INLOGGEN.md §12's planned unit tests can target it
// directly — it's the one bit of pure logic in an otherwise form-heavy
// component.
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "Dit e-mailadres is al in gebruik.";
    case "auth/invalid-email":
      return "Ongeldig e-mailadres.";
    case "auth/weak-password":
      return "Wachtwoord is te zwak (minimaal 6 tekens).";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Onjuist e-mailadres of wachtwoord.";
    case "auth/user-not-found":
      return "Geen account gevonden met dit e-mailadres.";
    case "auth/too-many-requests":
      return "Te veel pogingen. Probeer het later opnieuw.";
    case "auth/account-exists-with-different-credential":
      return "Dit e-mailadres heeft al een account met een wachtwoord. Log in met je wachtwoord.";
    default:
      return "Er ging iets mis. Probeer het opnieuw.";
  }
}

const MIN_PASSWORD_LENGTH = 8;

export function AuthModal({ open, onClose, onAuthenticated }: AuthModalProps) {
  const { suppressAutoProfileLoadRef, refreshCurrentVisitor, refreshCurrentBusiness } = useAuth();
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  function reset() {
    setStep("login");
    setEmail("");
    setPassword("");
    setError(null);
    setSubmitting(false);
    setResetSent(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function switchTo(next: Step) {
    setError(null);
    setPassword("");
    setResetSent(false);
    setStep(next);
  }

  // A fresh registration or a first-time Google sign-in logs the client in
  // before any Firestore profile exists — suppressing the auth listener's
  // own auto-create here means this explicit write is the only one that
  // runs, and refreshCurrentVisitor makes it visible in context
  // deterministically instead of racing the listener's async chain
  // (PLAN-INLOGGEN.md §6, mirrors the pre-existing business-registration
  // pattern this replaces).
  async function createFreshVisitorProfile(uid: string, userEmail: string): Promise<Visitor> {
    suppressAutoProfileLoadRef.current = true;
    try {
      const visitor = await createVisitorProfile(uid, userEmail);
      await refreshCurrentVisitor(uid);
      return visitor;
    } finally {
      suppressAutoProfileLoadRef.current = false;
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const cred = await signInWithPassword(email, password);
      const visitor =
        (await getVisitorProfile(cred.user.uid)) ?? (await createFreshVisitorProfile(cred.user.uid, email));
      handleClose();
      onAuthenticated(visitor);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Wachtwoord moet minimaal ${MIN_PASSWORD_LENGTH} tekens zijn.`);
      return;
    }
    setSubmitting(true);
    try {
      const cred = await registerWithPassword(email, password);
      const visitor = await createFreshVisitorProfile(cred.user.uid, email);
      // Fire-and-forget from the user's point of view — a failure here
      // (rate limiting, etc.) shouldn't block registration itself; the
      // reminder strip's own "opnieuw versturen" covers the retry.
      sendVerificationEmail().catch((err) => console.error("Verification email error:", err));
      handleClose();
      onAuthenticated(visitor);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await sendPasswordReset(email);
    } catch (err) {
      // Deliberately swallowed — showing the same "check je inbox" message
      // whether or not the address exists is the whole point of this step
      // (PLAN-INLOGGEN.md §7), otherwise it's a free account-existence
      // checker. Still logged for our own diagnostics.
      console.error("Password reset error:", err);
    } finally {
      setSubmitting(false);
      setResetSent(true);
    }
  }

  async function handleGoogle() {
    setError(null);
    setSubmitting(true);
    try {
      const cred = await signInWithGoogle();
      if (!cred) {
        // Popup was blocked; signInWithGoogle() already kicked off a
        // full-page redirect. There's nothing left to do here — the redirect
        // result is handled by useAuth on the next page load.
        return;
      }
      const uid = cred.user.uid;
      const userEmail = cred.user.email ?? "";
      const visitor = isNewGoogleUser(cred)
        ? await createFreshVisitorProfile(uid, userEmail)
        : ((await getVisitorProfile(uid)) ?? (await createFreshVisitorProfile(uid, userEmail)));
      // Returning users may already have a business profile — warm it in
      // context now rather than waiting on the (unsuppressed) listener, so
      // the account menu doesn't flash "Account" before it resolves.
      await refreshCurrentBusiness(uid);
      handleClose();
      onAuthenticated(visitor);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      // The user closing the popup themselves isn't an error worth showing.
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(authErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const title = step === "login" ? "Inloggen" : step === "register" ? "Account aanmaken" : "Wachtwoord vergeten";

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      <div className={styles.card}>
        <button type="button" className={styles.googleButton} onClick={handleGoogle} disabled={submitting}>
          <span className={styles.googleIcon} aria-hidden="true">
            G
          </span>
          Doorgaan met Google
        </button>

        {step !== "forgot" && (
          <div className={styles.divider}>
            <span>of</span>
          </div>
        )}

        {step === "login" && (
          <form className={styles.form} onSubmit={handleLogin}>
            <label htmlFor="auth-login-email">E-mailadres</label>
            <input
              id="auth-login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className={styles.passwordLabelRow}>
              <label htmlFor="auth-login-password">Wachtwoord</label>
              <button type="button" className={styles.linkButton} onClick={() => switchTo("forgot")}>
                Wachtwoord vergeten?
              </button>
            </div>
            <input
              id="auth-login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={styles.submitButton} disabled={submitting}>
              Inloggen
            </button>
            <button type="button" className={styles.linkButton} onClick={() => switchTo("register")}>
              Nog geen account? Registreer
            </button>
          </form>
        )}

        {step === "register" && (
          <form className={styles.form} onSubmit={handleRegister}>
            <label htmlFor="auth-register-email">E-mailadres</label>
            <input
              id="auth-register-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="auth-register-password">Wachtwoord</label>
            <input
              id="auth-register-password"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" className={styles.submitButton} disabled={submitting}>
              Account aanmaken
            </button>
            <button type="button" className={styles.linkButton} onClick={() => switchTo("login")}>
              Al een account? Inloggen
            </button>
          </form>
        )}

        {step === "forgot" &&
          (resetSent ? (
            <div className={styles.sent}>
              <p>Als er een account bestaat bij {email}, hebben we er een link naartoe gestuurd. Check je inbox.</p>
              <button type="button" className={styles.linkButton} onClick={() => switchTo("login")}>
                Terug naar inloggen
              </button>
            </div>
          ) : (
            <form className={styles.form} onSubmit={handleForgot}>
              <label htmlFor="auth-forgot-email">E-mailadres</label>
              <input
                id="auth-forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className={styles.submitButton} disabled={submitting}>
                Verstuur link
              </button>
              <button type="button" className={styles.linkButton} onClick={() => switchTo("login")}>
                Terug naar inloggen
              </button>
            </form>
          ))}
      </div>
    </Modal>
  );
}

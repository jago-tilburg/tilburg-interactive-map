"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { loginBusiness, registerBusiness } from "@/lib/firebase/auth";
import { createBusinessProfile } from "@/lib/firebase/firestore";
import styles from "./BusinessAuthModal.module.css";

interface BusinessAuthModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "login" | "register";

function businessAuthErrorMessage(error: unknown): string {
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
    default:
      return "Er ging iets mis. Probeer het opnieuw.";
  }
}

export function BusinessAuthModal({ open, onClose }: BusinessAuthModalProps) {
  const { suppressAutoProfileLoadRef } = useAuth();
  const [step, setStep] = useState<Step>("login");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setStep("login");
    setBusinessName("");
    setEmail("");
    setPassword("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginBusiness(email, password);
      handleClose();
    } catch (err) {
      setError(businessAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!businessName.trim()) {
      setError("Bedrijfsnaam is verplicht.");
      return;
    }
    if (password.length < 6) {
      setError("Wachtwoord moet minimaal 6 tekens zijn.");
      return;
    }
    setSubmitting(true);
    suppressAutoProfileLoadRef.current = true;
    try {
      const cred = await registerBusiness(email, password);
      await createBusinessProfile(cred.user.uid, businessName, email);
      handleClose();
    } catch (err) {
      setError(businessAuthErrorMessage(err));
    } finally {
      suppressAutoProfileLoadRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={step === "login" ? "Inloggen" : "Account aanmaken"}>
      {step === "login" ? (
        <form className={styles.form} onSubmit={handleLogin}>
          <label htmlFor="ba-login-email">E-mailadres</label>
          <input
            id="ba-login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="ba-login-password">Wachtwoord</label>
          <input
            id="ba-login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" disabled={submitting}>
            Inloggen
          </button>
          <button type="button" className={styles.linkButton} onClick={() => { reset(); setStep("register"); }}>
            Nog geen account? Registreer
          </button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={handleRegister}>
          <label htmlFor="ba-register-name">Bedrijfsnaam</label>
          <input
            id="ba-register-name"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
          <label htmlFor="ba-register-email">E-mailadres</label>
          <input
            id="ba-register-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="ba-register-password">Wachtwoord</label>
          <input
            id="ba-register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" disabled={submitting}>
            Account aanmaken
          </button>
          <button type="button" className={styles.linkButton} onClick={() => { reset(); setStep("login"); }}>
            Al een account? Inloggen
          </button>
        </form>
      )}
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { sendVisitorMagicLink, VISITOR_AUTH_EMAIL_KEY } from "@/lib/firebase/auth";
import styles from "./VisitorAuthModal.module.css";

interface VisitorAuthModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "request" | "sent";

export function VisitorAuthModal({ open, onClose }: VisitorAuthModalProps) {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function handleClose() {
    setStep("request");
    setEmail("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await sendVisitorMagicLink(email);
      window.localStorage.setItem(VISITOR_AUTH_EMAIL_KEY, email);
      setStep("sent");
    } catch {
      setError("Er ging iets mis bij het versturen van de inloglink. Probeer het opnieuw.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Inloggen als bezoeker">
      {step === "request" ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          <label htmlFor="visitor-email">E-mailadres</label>
          <input
            id="visitor-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" disabled={sending}>
            Verstuur inloglink
          </button>
          <button type="button" className={styles.cancelButton} onClick={handleClose}>
            Annuleren
          </button>
        </form>
      ) : (
        <div className={styles.sent}>
          <p>We hebben een inloglink gestuurd naar {email}. Check je inbox.</p>
          <button type="button" onClick={handleClose}>
            Sluiten
          </button>
        </div>
      )}
    </Modal>
  );
}

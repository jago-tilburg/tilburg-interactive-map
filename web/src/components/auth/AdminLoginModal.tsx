"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { loginAdmin } from "@/lib/firebase/auth";
import styles from "./AdminLoginModal.module.css";

interface AdminLoginModalProps {
  open: boolean;
  onClose: () => void;
}

export function AdminLoginModal({ open, onClose }: AdminLoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setEmail("");
    setPassword("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginAdmin(email, password);
      handleClose();
    } catch {
      setError("Inloggen mislukt. Controleer je gegevens.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Admin inloggen">
      <form className={styles.form} onSubmit={handleSubmit}>
        <label htmlFor="admin-email">E-mailadres</label>
        <input
          id="admin-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="admin-password">Wachtwoord</label>
        <input
          id="admin-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          Inloggen
        </button>
        <button type="button" className={styles.cancelButton} onClick={handleClose}>
          Annuleren
        </button>
      </form>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { submitRequest } from "@/lib/firebase/requests";
import { trackEvent } from "@/lib/analytics/trackEvent";
import { getAnonUserId } from "@/lib/shops/anonUserId";
import { useAuth } from "@/hooks/useAuth";
import styles from "./RequestModal.module.css";

interface RequestModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export function RequestModal({ open, onClose, onSubmitted }: RequestModalProps) {
  const { currentVisitor } = useAuth();
  const [shopName, setShopName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setShopName("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = shopName.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const userId = currentVisitor?.uid ?? getAnonUserId();
      await submitRequest(trimmed, userId);
      trackEvent("submit_review_request", { shop_name: trimmed });
      setShopName("");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? "Er ging iets mis: " + err.message : "Er ging iets mis. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Vraag een Review Aan">
      <form className={styles.form} onSubmit={handleSubmit}>
        <p className={styles.hint}>Ken je een top broodjeszaak die ik moet proberen?</p>
        <input
          type="text"
          placeholder="Naam van de zaak..."
          aria-label="Naam van de zaak"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
        />
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="submit" disabled={submitting}>
            Versturen
          </button>
          <button type="button" onClick={handleClose}>
            Annuleren
          </button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { RATING_SELECT_OPTIONS } from "@/lib/shops/shopHelpers";
import styles from "./UserReviewModal.module.css";

interface UserReviewModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; rating: number; text: string }) => void;
  defaultName?: string;
}

export function UserReviewModal({ open, onClose, onSubmit, defaultName = "" }: UserReviewModalProps) {
  const [name, setName] = useState(defaultName);
  const [rating, setRating] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(defaultName);
    setRating("");
    setText("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !rating || !text.trim()) {
      setError("Vul alle velden in");
      return;
    }
    onSubmit({ name: name.trim(), rating: parseFloat(rating), text: text.trim() });
    reset();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Voeg Je Review Toe">
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Jouw naam"
          aria-label="Jouw naam"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select aria-label="Beoordeling" value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="">Selecteer beoordeling (1-10)</option>
          {RATING_SELECT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} ⭐
            </option>
          ))}
        </select>
        <textarea
          placeholder="Je review..."
          aria-label="Je review"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="submit">Versturen</button>
          <button type="button" onClick={handleClose}>
            Annuleren
          </button>
        </div>
      </form>
    </Modal>
  );
}

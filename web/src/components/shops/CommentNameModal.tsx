"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import styles from "./CommentNameModal.module.css";

interface CommentNameModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (name: string) => void;
  defaultName?: string;
}

export function CommentNameModal({ open, onCancel, onSubmit, defaultName = "" }: CommentNameModalProps) {
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Vul een naam in om een reactie te plaatsen");
      return;
    }
    onSubmit(name.trim());
    setName("");
    setError(null);
  }

  function handleCancel() {
    setName(defaultName);
    setError(null);
    onCancel();
  }

  return (
    <Modal open={open} onClose={handleCancel} title="Wat is je naam?">
      <form className={styles.form} onSubmit={handleSubmit}>
        <p className={styles.hint}>Je naam wordt getoond bij je reactie</p>
        <input
          type="text"
          placeholder="Jouw naam"
          aria-label="Jouw naam"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}>
          <button type="submit">Versturen</button>
          <button type="button" onClick={handleCancel}>
            Annuleren
          </button>
        </div>
      </form>
    </Modal>
  );
}

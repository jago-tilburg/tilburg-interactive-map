"use client";

import { Modal } from "@/components/common/Modal";
import styles from "./RequestConfirmationModal.module.css";

interface RequestConfirmationModalProps {
  open: boolean;
  onClose: () => void;
}

export function RequestConfirmationModal({ open, onClose }: RequestConfirmationModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Bedankt voor je suggestie!">
      <div className={styles.wrapper}>
        <div className={styles.emoji}>🥪</div>
        <p className={styles.text}>We gaan hem bekijken</p>
        <button type="button" className={styles.closeButton} onClick={onClose}>
          Sluiten
        </button>
      </div>
    </Modal>
  );
}

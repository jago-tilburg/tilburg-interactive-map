"use client";

import { Modal } from "@/components/common/Modal";
import styles from "./AccountChooserModal.module.css";

interface AccountChooserModalProps {
  open: boolean;
  onClose: () => void;
  onChooseVisitor: () => void;
  onChooseBusiness: () => void;
}

export function AccountChooserModal({
  open,
  onClose,
  onChooseVisitor,
  onChooseBusiness,
}: AccountChooserModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="👋 Account">
      <p className={styles.subtitle}>Waarvoor wil je inloggen?</p>
      <div className={styles.choices}>
        <button type="button" className={`${styles.choiceButton} ${styles.visitorChoice}`} onClick={onChooseVisitor}>
          👤 Ik ben bezoeker
        </button>
        <button type="button" className={`${styles.choiceButton} ${styles.businessChoice}`} onClick={onChooseBusiness}>
          🎉 Ik ben Event Owner
        </button>
      </div>
      <button type="button" className={styles.cancelButton} onClick={onClose}>
        Annuleren
      </button>
    </Modal>
  );
}

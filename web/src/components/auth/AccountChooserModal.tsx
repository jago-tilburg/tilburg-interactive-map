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
    <Modal open={open} onClose={onClose} title="Wie ben je?">
      <button type="button" className={styles.choiceButton} onClick={onChooseVisitor}>
        👤 Ik ben bezoeker
      </button>
      <button type="button" className={styles.choiceButton} onClick={onChooseBusiness}>
        🎉 Ik ben Event Owner
      </button>
      <button type="button" className={styles.cancelButton} onClick={onClose}>
        Annuleren
      </button>
    </Modal>
  );
}

"use client";

import { Modal } from "@/components/common/Modal";
import styles from "./RoleChoiceModal.module.css";

export type RoleChoice = "visitor" | "business";

interface RoleChoiceModalProps {
  open: boolean;
  onClose: () => void;
  // A brand-new account picking "business" here skips straight to the
  // event-profile creation step after onboarding, instead of landing on the
  // generic chooser (see AccountMenu's handleAuthenticated) — the whole
  // point of asking this before the account even exists.
  onChoose: (role: RoleChoice) => void;
  onSkipToLogin: () => void;
}

// Shown to a signed-out visitor before AuthModal, so a first-time event host
// doesn't have to discover "Event-profiel aanmaken" buried in the post-auth
// chooser — they declare intent up front and get routed straight there.
export function RoleChoiceModal({ open, onClose, onChoose, onSkipToLogin }: RoleChoiceModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Welkom bij 2happies">
      <div className={styles.chooser}>
        <button type="button" className={styles.chooserButton} onClick={() => onChoose("visitor")}>
          <span className={styles.emoji} aria-hidden="true">
            🗺️
          </span>
          <span>
            <strong>Ik ben bezoeker</strong>
            <small>Ontdek broodjeszaken en events in Tilburg</small>
          </span>
        </button>
        <button type="button" className={styles.chooserButton} onClick={() => onChoose("business")}>
          <span className={styles.emoji} aria-hidden="true">
            🏢
          </span>
          <span>
            <strong>Ik ben event-host</strong>
            <small>Plaats en beheer je eigen events</small>
          </span>
        </button>
        <button type="button" className={styles.skipLink} onClick={onSkipToLogin}>
          Ik heb al een account, inloggen
        </button>
      </div>
    </Modal>
  );
}

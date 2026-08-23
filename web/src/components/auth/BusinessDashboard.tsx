"use client";

import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { signOutCurrentUser } from "@/lib/firebase/auth";
import styles from "./BusinessDashboard.module.css";

interface BusinessDashboardProps {
  open: boolean;
  onClose: () => void;
}

export function BusinessDashboard({ open, onClose }: BusinessDashboardProps) {
  const { currentBusiness } = useAuth();

  async function handleLogout() {
    await signOutCurrentUser();
    onClose();
  }

  if (!currentBusiness) return null;

  return (
    <Modal open={open} onClose={onClose} title={currentBusiness.businessName}>
      <p className={styles.email}>{currentBusiness.email}</p>
      <div className={styles.events}>
        {/* Event list is a placeholder — businessEvents domain (submission,
            approval workflow) is a separate porting phase, out of scope here.
            Matches the monolith's own current placeholder state. */}
        <p className={styles.empty}>Evenementen komen hier binnenkort.</p>
      </div>
      <button type="button" onClick={handleLogout}>
        Uitloggen
      </button>
      <button type="button" onClick={onClose}>
        Sluiten
      </button>
    </Modal>
  );
}

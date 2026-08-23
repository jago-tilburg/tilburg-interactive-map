"use client";

import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { signOutCurrentUser } from "@/lib/firebase/auth";
import styles from "./VisitorDashboard.module.css";

interface VisitorDashboardProps {
  open: boolean;
  onClose: () => void;
}

export function VisitorDashboard({ open, onClose }: VisitorDashboardProps) {
  const { currentVisitor } = useAuth();

  async function handleLogout() {
    await signOutCurrentUser();
    onClose();
  }

  if (!currentVisitor) return null;

  return (
    <Modal open={open} onClose={onClose} title="Mijn account">
      <p className={styles.email}>{currentVisitor.email}</p>
      <div className={styles.likedShops}>
        <h3>Geliked</h3>
        {/* Liked-shops list intentionally stubbed empty — depends on the
            RTDB shop/likes feature, which is map/shop domain and out of
            scope for this auth-only port. */}
        <p className={styles.empty}>Nog geen shops geliked.</p>
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

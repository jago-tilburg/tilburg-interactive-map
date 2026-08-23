"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AccountChooserModal } from "./AccountChooserModal";
import { VisitorAuthModal } from "./VisitorAuthModal";
import { VisitorDashboard } from "./VisitorDashboard";
import { BusinessAuthModal } from "./BusinessAuthModal";
import { BusinessDashboard } from "./BusinessDashboard";
import { AdminPanel } from "@/components/admin/AdminPanel";
import styles from "./AccountMenu.module.css";

type ActiveModal =
  | null
  | "chooser"
  | "visitorAuth"
  | "visitorDashboard"
  | "businessAuth"
  | "businessDashboard"
  | "adminPanel";

// Mirrors the monolith's updateMenuVisibility() + openAccountEntry() —
// conditional label/entry rendering based on the priority-ordered auth state
// from useAuth (admin > business > visitor > signed out).
export function AccountMenu() {
  const { isAdmin, currentVisitor, currentBusiness } = useAuth();
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  function openAccountEntry() {
    if (isAdmin) {
      setActiveModal("adminPanel");
    } else if (currentBusiness) {
      setActiveModal("businessDashboard");
    } else if (currentVisitor) {
      setActiveModal("visitorDashboard");
    } else {
      setActiveModal("chooser");
    }
  }

  const label = isAdmin
    ? "🛠️ Admin"
    : currentBusiness
      ? `🎉 ${currentBusiness.businessName}`
      : currentVisitor
        ? `👤 ${currentVisitor.displayName}`
        : "👤 Account";

  return (
    <nav className={styles.menu}>
      <button type="button" className={styles.accountLink} onClick={openAccountEntry}>
        {label}
      </button>

      <AccountChooserModal
        open={activeModal === "chooser"}
        onClose={() => setActiveModal(null)}
        onChooseVisitor={() => setActiveModal("visitorAuth")}
        onChooseBusiness={() => setActiveModal("businessAuth")}
      />
      <VisitorAuthModal open={activeModal === "visitorAuth"} onClose={() => setActiveModal(null)} />
      <VisitorDashboard open={activeModal === "visitorDashboard"} onClose={() => setActiveModal(null)} />
      <BusinessAuthModal open={activeModal === "businessAuth"} onClose={() => setActiveModal(null)} />
      <BusinessDashboard open={activeModal === "businessDashboard"} onClose={() => setActiveModal(null)} />
      <AdminPanel open={activeModal === "adminPanel"} onClose={() => setActiveModal(null)} />
    </nav>
  );
}

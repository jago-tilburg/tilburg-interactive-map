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

interface AccountMenuProps {
  onOpenShop: (shopId: number) => void;
  onOpenEvent: (eventId: string) => void;
}

// Mirrors the monolith's updateMenuVisibility() + openAccountEntry() —
// conditional label/entry rendering based on the priority-ordered auth state
// from useAuth (admin > business > visitor > signed out).
export function AccountMenu({ onOpenShop, onOpenEvent }: AccountMenuProps) {
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

  // The button is always just the person glyph — never the role or the
  // account's own name as visible text. Who you're signed in as moves to the
  // accessible name instead, so nothing is lost for screen readers while the
  // button keeps a fixed icon width at every viewport. That width matters:
  // a business name is arbitrarily long, and as visible text it used to widen
  // the header until the hamburger was clipped off the right edge of a phone.
  const accountName = isAdmin
    ? "Admin"
    : currentBusiness
      ? currentBusiness.businessName
      : currentVisitor
        ? currentVisitor.displayName
        : "Account";

  return (
    <nav className={styles.menu}>
      <button
        type="button"
        className={styles.accountLink}
        onClick={openAccountEntry}
        aria-label={accountName}
        title={accountName}
      >
        👤
      </button>

      <AccountChooserModal
        open={activeModal === "chooser"}
        onClose={() => setActiveModal(null)}
        onChooseVisitor={() => setActiveModal("visitorAuth")}
        onChooseBusiness={() => setActiveModal("businessAuth")}
      />
      <VisitorAuthModal open={activeModal === "visitorAuth"} onClose={() => setActiveModal(null)} />
      <VisitorDashboard
        open={activeModal === "visitorDashboard"}
        onClose={() => setActiveModal(null)}
        onOpenShop={(shopId) => {
          setActiveModal(null);
          onOpenShop(shopId);
        }}
        onOpenEvent={(eventId) => {
          setActiveModal(null);
          onOpenEvent(eventId);
        }}
      />
      <BusinessAuthModal open={activeModal === "businessAuth"} onClose={() => setActiveModal(null)} />
      <BusinessDashboard open={activeModal === "businessDashboard"} onClose={() => setActiveModal(null)} />
      <AdminPanel open={activeModal === "adminPanel"} onClose={() => setActiveModal(null)} />
    </nav>
  );
}

"use client";

import { useState } from "react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { MenuModal } from "@/components/menu/MenuModal";
import { RequestModal } from "@/components/requests/RequestModal";
import { RequestConfirmationModal } from "@/components/requests/RequestConfirmationModal";
import type { MapFilterState, MapFilterActions } from "@/hooks/useMapFilterState";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./Header.module.css";

interface HeaderProps {
  shops: Shop[];
  businessEvents: BusinessEvent[];
  umbrellaEvents: UmbrellaEvent[];
  onSelectShop: (shopId: number) => void;
  onSelectEvent: (eventId: string) => void;
  loading?: boolean;
  filterState: MapFilterState & MapFilterActions;
}

// Mirrors the prototype's .header exactly: gradient bar, always-visible
// "Vraag een review aan" (no admin/visitor conditional — everyone sees it),
// the account entry point, and a hamburger opening the full "ALLE 2
// HAPPIES" list modal.
export function Header({
  shops,
  businessEvents,
  umbrellaEvents,
  onSelectShop,
  onSelectEvent,
  loading = false,
  filterState,
}: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestConfirmationOpen, setRequestConfirmationOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>2 HAPPIES BIJ</h1>
        <div className={styles.actions}>
          <button type="button" className={styles.requestBtn} onClick={() => setRequestModalOpen(true)}>
            📝 Vraag een review aan
          </button>
          <AccountMenu />
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setMenuOpen(true)}
            aria-label="Alle 2 Happies"
          >
            🥪
          </button>
        </div>
      </header>

      <MenuModal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        shops={shops}
        businessEvents={businessEvents}
        umbrellaEvents={umbrellaEvents}
        loading={loading}
        onSelectShop={(id) => {
          onSelectShop(id);
          setMenuOpen(false);
        }}
        onSelectEvent={(id) => {
          onSelectEvent(id);
          setMenuOpen(false);
        }}
        filterState={filterState}
      />

      <RequestModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        onSubmitted={() => {
          setRequestModalOpen(false);
          setRequestConfirmationOpen(true);
        }}
      />
      <RequestConfirmationModal
        open={requestConfirmationOpen}
        onClose={() => setRequestConfirmationOpen(false)}
      />
    </>
  );
}

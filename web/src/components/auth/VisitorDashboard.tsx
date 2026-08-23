"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { signOutCurrentUser } from "@/lib/firebase/auth";
import { subscribeVisitorProfile } from "@/lib/firebase/firestore";
import { subscribeShops } from "@/lib/firebase/shops";
import { subscribeApprovedBusinessEvents } from "@/lib/firebase/businessEvents";
import { categoryOf, formatBusinessEventSchedule } from "@/lib/events/eventHelpers";
import type { Visitor } from "@/types/account";
import type { Shop } from "@/types/shops";
import type { BusinessEvent } from "@/types/events";
import styles from "./VisitorDashboard.module.css";

interface VisitorDashboardProps {
  open: boolean;
  onClose: () => void;
}

export function VisitorDashboard({ open, onClose }: VisitorDashboardProps) {
  const { currentVisitor } = useAuth();
  const [liveVisitor, setLiveVisitor] = useState<Visitor | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [businessEvents, setBusinessEvents] = useState<BusinessEvent[]>([]);

  useEffect(() => {
    if (!open || !currentVisitor) return;
    const unsubVisitor = subscribeVisitorProfile(currentVisitor.uid, setLiveVisitor);
    const unsubShops = subscribeShops(setShops);
    const unsubEvents = subscribeApprovedBusinessEvents(setBusinessEvents);
    return () => {
      unsubVisitor();
      unsubShops();
      unsubEvents();
    };
  }, [open, currentVisitor]);

  async function handleLogout() {
    await signOutCurrentUser();
    onClose();
  }

  if (!currentVisitor) return null;

  const uid = currentVisitor.uid;
  const likedShops = shops.filter((s) => s.likes?.includes(uid));
  const ratedShops = shops
    .map((s) => ({ shop: s, rating: s.userRatings?.find((r) => r.userId === uid)?.rating }))
    .filter((entry): entry is { shop: Shop; rating: number } => entry.rating !== undefined);
  const savedEventIds = liveVisitor?.savedEventIds ?? currentVisitor.savedEventIds ?? [];
  const savedEvents = businessEvents.filter((e) => savedEventIds.includes(e.id));

  return (
    <Modal open={open} onClose={onClose} title="Mijn account">
      <p className={styles.email}>{currentVisitor.email}</p>

      <div className={styles.section}>
        <h3>🔖 Bewaarde evenementen</h3>
        {savedEvents.length === 0 ? (
          <p className={styles.empty}>Nog geen evenementen bewaard.</p>
        ) : (
          <ul className={styles.list}>
            {savedEvents.map((e) => (
              <li key={e.id}>
                {categoryOf(e.category).emoji} {e.title} — {formatBusinessEventSchedule(e)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <h3>❤️ Geliked</h3>
        {likedShops.length === 0 ? (
          <p className={styles.empty}>Nog geen shops geliked.</p>
        ) : (
          <ul className={styles.list}>
            {likedShops.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <h3>⭐ Mijn ratings</h3>
        {ratedShops.length === 0 ? (
          <p className={styles.empty}>Nog geen ratings gegeven.</p>
        ) : (
          <ul className={styles.list}>
            {ratedShops.map(({ shop, rating }) => (
              <li key={shop.id}>
                {shop.name} — {rating.toFixed(1)} ⭐
              </li>
            ))}
          </ul>
        )}
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

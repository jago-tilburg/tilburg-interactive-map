"use client";

import { useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { categoryOf, formatBusinessEventSchedule } from "@/lib/events/eventHelpers";
import { shareCurrentUrl } from "@/lib/shareUrl";
import { trackEvent } from "@/lib/analytics/trackEvent";
import { useToast } from "@/hooks/useToast";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./UmbrellaEventDetailModal.module.css";

interface UmbrellaEventDetailModalProps {
  open: boolean;
  onClose: () => void;
  umbrella: UmbrellaEvent | null;
  approvedBusinessEvents: BusinessEvent[];
  onOpenEvent?: (eventId: string) => void;
}

export function UmbrellaEventDetailModal({
  open,
  onClose,
  umbrella,
  approvedBusinessEvents,
  onOpenEvent,
}: UmbrellaEventDetailModalProps) {
  const { showToast } = useToast();

  useEffect(() => {
    if (!open || !umbrella) return;
    trackEvent("umbrella_detail_open");
  }, [open, umbrella]);

  if (!umbrella) return null;
  const children = approvedBusinessEvents.filter((ev) => ev.umbrellaEventId === umbrella.id);

  async function handleShare() {
    const usedNativeShare = typeof navigator.share === "function";
    const success = await shareCurrentUrl(umbrella!.title);
    if (success && !usedNativeShare) showToast("Link gekopieerd.", "success");
  }

  return (
    <Modal open={open} onClose={onClose} title={`🎪 ${umbrella.title}`} variant="detail">
      <p className={styles.dates}>
        🗓️ {umbrella.startDate} t/m {umbrella.endDate}
      </p>
      <button type="button" className={styles.shareButton} onClick={handleShare}>
        🔗 Delen
      </button>
      {umbrella.description && <p className={styles.description}>{umbrella.description}</p>}
      <h4>Onderdeel van dit evenement</h4>
      {children.length === 0 ? (
        <p className={styles.empty}>Nog geen goedgekeurde evenementen onder dit grote evenement.</p>
      ) : (
        <div className={styles.children}>
          {children.map((ev) => {
            const cat = categoryOf(ev.category);
            return (
              <button
                type="button"
                key={ev.id}
                className={styles.childItem}
                onClick={() => {
                  trackEvent("umbrella_child_event_click");
                  onOpenEvent?.(ev.id);
                }}
              >
                <div className={styles.childTitle}>
                  {cat.emoji} {ev.title}
                </div>
                <div className={styles.childSchedule}>{formatBusinessEventSchedule(ev)}</div>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

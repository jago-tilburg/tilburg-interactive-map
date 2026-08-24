"use client";

import { Modal } from "@/components/common/Modal";
import { categoryOf, formatBusinessEventSchedule } from "@/lib/events/eventHelpers";
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
  if (!umbrella) return null;
  const children = approvedBusinessEvents.filter((ev) => ev.umbrellaEventId === umbrella.id);

  return (
    <Modal open={open} onClose={onClose} title={`🎪 ${umbrella.title}`} variant="detail">
      <p className={styles.dates}>
        🗓️ {umbrella.startDate} t/m {umbrella.endDate}
      </p>
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
                onClick={() => onOpenEvent?.(ev.id)}
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

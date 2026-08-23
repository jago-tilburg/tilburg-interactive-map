"use client";

import { Modal } from "@/components/common/Modal";
import { categoryOf, formatBusinessEventSchedule } from "@/lib/events/eventHelpers";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./BusinessEventDetailModal.module.css";

interface BusinessEventDetailModalProps {
  open: boolean;
  onClose: () => void;
  event: BusinessEvent | null;
  umbrellaEvents: UmbrellaEvent[];
  onOpenUmbrella?: (umbrellaId: string) => void;
}

export function BusinessEventDetailModal({
  open,
  onClose,
  event,
  umbrellaEvents,
  onOpenUmbrella,
}: BusinessEventDetailModalProps) {
  if (!event) return null;
  const cat = categoryOf(event.category);
  const umbrella = event.umbrellaEventId
    ? umbrellaEvents.find((u) => u.id === event.umbrellaEventId)
    : undefined;

  return (
    <Modal open={open} onClose={onClose} title={`${cat.emoji} ${event.title}`}>
      {umbrella && (
        <button
          type="button"
          className={styles.umbrellaBadge}
          style={{
            color: umbrella.color,
            borderColor: `${umbrella.color}55`,
            background: `${umbrella.color}22`,
          }}
          onClick={() => onOpenUmbrella?.(umbrella.id)}
        >
          🎪 Onderdeel van {umbrella.title}
        </button>
      )}
      <p className={styles.address}>📍 {event.address}</p>
      <p className={styles.schedule}>🗓️ {formatBusinessEventSchedule(event)}</p>
      <p>{event.description}</p>
    </Modal>
  );
}

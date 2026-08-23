"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { categoryOf, formatBusinessEventSchedule } from "@/lib/events/eventHelpers";
import { trackEventView, incrementEventInterest, incrementEventClicks } from "@/lib/firebase/businessEvents";
import { setEventSaved } from "@/lib/firebase/firestore";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./BusinessEventDetailModal.module.css";

interface BusinessEventDetailModalProps {
  open: boolean;
  onClose: () => void;
  event: BusinessEvent | null;
  umbrellaEvents: UmbrellaEvent[];
  onOpenUmbrella?: (umbrellaId: string) => void;
}

const DESCRIPTION_TRUNCATE_LENGTH = 220;

export function BusinessEventDetailModal({
  open,
  onClose,
  event,
  umbrellaEvents,
  onOpenUmbrella,
}: BusinessEventDetailModalProps) {
  const { currentVisitor } = useAuth();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [interest, setInterest] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saveHint, setSaveHint] = useState<string | null>(null);

  // Keeps local counters/UI state in sync when a different event is shown,
  // adjusted during render (not an effect) per the pattern used across this
  // app's other detail modals for prop-driven resets.
  const [syncedEventId, setSyncedEventId] = useState<string | null>(null);
  if (open && event && event.id !== syncedEventId) {
    setSyncedEventId(event.id);
    setDescriptionExpanded(false);
    setInterest(event.interest ?? 0);
    setSaved(currentVisitor?.savedEventIds?.includes(event.id) ?? false);
    setSaveHint(null);
  }

  useEffect(() => {
    if (!open || !event) return;
    trackEventView(event.id).catch(() => {});
  }, [open, event]);

  if (!event) return null;
  const cat = categoryOf(event.category);
  const umbrella = event.umbrellaEventId
    ? umbrellaEvents.find((u) => u.id === event.umbrellaEventId)
    : undefined;

  const description =
    !descriptionExpanded && event.description.length > DESCRIPTION_TRUNCATE_LENGTH
      ? event.description.slice(0, DESCRIPTION_TRUNCATE_LENGTH) + "…"
      : event.description;

  async function handleInterest() {
    setInterest((n) => n + 1);
    try {
      await incrementEventInterest(event!.id);
    } catch {
      setInterest((n) => Math.max(0, n - 1));
    }
  }

  async function handleToggleSave() {
    if (!currentVisitor) {
      setSaveHint("Log in om evenementen te bewaren.");
      return;
    }
    const next = !saved;
    setSaved(next);
    setSaveHint(null);
    try {
      await setEventSaved(currentVisitor.uid, event!.id, next);
    } catch {
      setSaved(!next);
    }
  }

  function handleWebsiteClick() {
    incrementEventClicks(event!.id).catch(() => {});
    window.open(event!.websiteUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <Modal open={open} onClose={onClose} title={`${cat.emoji} ${event.title}`}>
      {event.photoUrl ? (
        <img src={event.photoUrl} alt={event.title} className={styles.photo} />
      ) : (
        <div className={styles.photoPlaceholder}>{cat.emoji}</div>
      )}

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
      <p>
        {description}
        {event.description.length > DESCRIPTION_TRUNCATE_LENGTH && (
          <button
            type="button"
            className={styles.readMoreToggle}
            onClick={() => setDescriptionExpanded((v) => !v)}
          >
            {descriptionExpanded ? "Minder tonen" : "Meer lezen"}
          </button>
        )}
      </p>

      {event.prices && event.prices.length > 0 && (
        <div className={styles.prices}>
          {event.prices.map((price, i) => (
            <div key={i} className={styles.priceLine}>
              <span>{price.label}</span>
              <span>{price.amount === 0 ? "Gratis" : `€${price.amount.toFixed(2)}`}</span>
            </div>
          ))}
        </div>
      )}

      <div className={styles.ctaBar}>
        <button type="button" className={saved ? styles.saveActive : styles.save} onClick={handleToggleSave}>
          {saved ? "🔖 Bewaard" : "🔖 Bewaar"}
        </button>
        <button type="button" className={styles.interest} onClick={handleInterest}>
          👍 {interest}
        </button>
        {event.websiteUrl && (
          <button type="button" className={styles.website} onClick={handleWebsiteClick}>
            🎟️ Ik wil hierheen!
          </button>
        )}
      </div>
      {saveHint && <p className={styles.saveHint}>{saveHint}</p>}
    </Modal>
  );
}

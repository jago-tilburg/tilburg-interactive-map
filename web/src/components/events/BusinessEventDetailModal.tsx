"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { categoryOf, formatBusinessEventSchedule } from "@/lib/events/eventHelpers";
import {
  trackEventView,
  incrementEventInterest,
  incrementEventClicks,
  incrementEventShares,
} from "@/lib/firebase/businessEvents";
import { setEventSaved } from "@/lib/firebase/firestore";
import { isSafeHttpUrl } from "@/lib/safeUrl";
import { photoVariantUrl } from "@/lib/photos/photoVariants";
import { shareCurrentUrl } from "@/lib/shareUrl";
import { useToast } from "@/hooks/useToast";
import { ReportModal } from "@/components/common/ReportModal";
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
  const { showToast } = useToast();
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [interest, setInterest] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

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
    if (!isSafeHttpUrl(event!.websiteUrl)) return;
    incrementEventClicks(event!.id).catch(() => {});
    window.open(event!.websiteUrl, "_blank", "noopener,noreferrer");
  }

  async function handleShare() {
    const usedNativeShare = typeof navigator.share === "function";
    const success = await shareCurrentUrl(event!.title);
    if (!success) return;
    if (!usedNativeShare) showToast("Link gekopieerd.", "success");
    incrementEventShares(event!.id).catch(() => {});
  }

  return (
    <>
      <Modal
        open={open && !reportModalOpen}
        onClose={onClose}
        title={`${cat.emoji} ${event.title}`}
        variant="detail"
      >
        <div className={styles.shell}>
          {/* Photo narrower, info wider on desktop (1fr/1.4fr) — collapses to
              one stacked column on mobile, matching the prototype's
              event-detail-columns. The CTA bar stays a sibling of this grid,
              not inside it, on both layouts. */}
          <div className={styles.columns}>
            <div className={styles.photoColumn}>
              {event.photoUrl ? (
                <img
                  src={photoVariantUrl(event.photoUrl, "detail")}
                  alt={event.title}
                  className={styles.photo}
                  onError={(e) => {
                    if (e.currentTarget.src !== event.photoUrl) e.currentTarget.src = event.photoUrl!;
                  }}
                />
              ) : (
                <div className={styles.photoPlaceholder}>{cat.emoji}</div>
              )}
            </div>

            <div className={styles.infoColumn}>
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
            </div>
          </div>
        </div>

        <div className={styles.ctaBar}>
          <button type="button" className={saved ? styles.saveActive : styles.save} onClick={handleToggleSave}>
            {saved ? "🔖 Bewaard" : "🔖 Bewaar"}
          </button>
          <button type="button" className={styles.interest} onClick={handleInterest}>
            👍 {interest}
          </button>
          {isSafeHttpUrl(event.websiteUrl) && (
            <button type="button" className={styles.website} onClick={handleWebsiteClick}>
              🎟️ Ik wil hierheen!
            </button>
          )}
          <button type="button" className={styles.shareButton} onClick={handleShare}>
            🔗 Delen
          </button>
          <button type="button" className={styles.reportButton} onClick={() => setReportModalOpen(true)}>
            🚩 Melden
          </button>
        </div>
        {saveHint && <p className={styles.saveHint}>{saveHint}</p>}
      </Modal>
      <ReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        contentType="businessEvent"
        contentId={event.id}
      />
    </>
  );
}

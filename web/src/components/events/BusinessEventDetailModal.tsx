"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { categoryOf, dateRangeArray } from "@/lib/events/eventHelpers";
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
import { buildNavigationUrl } from "@/lib/shops/navigateToLocation";
import { trackEvent } from "@/lib/analytics/trackEvent";
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
  // True when rendering a live, unsaved draft from BusinessEventForm's
  // preview button — the event has no real Firestore doc yet, so every
  // write path (analytics, interest/save persistence, click/share counters,
  // reporting) is skipped instead of hitting Firestore with a fake id.
  previewMode?: boolean;
  // Small corner overlay in the hero photo showing how this event's marker
  // will look on the map — only ever passed from the preview button.
  markerPreview?: React.ReactNode;
}

const DESCRIPTION_TRUNCATE_LENGTH = 220;

// "di 1 sep" — nl-NL's short weekday/month Intl output comes back with a
// trailing period ("di 1 sep."); the reference design doesn't have one.
function formatDayLabel(date: string): string {
  return new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" })
    .format(new Date(`${date}T00:00:00`))
    .replace(/\.$/, "");
}

export function BusinessEventDetailModal({
  open,
  onClose,
  event,
  umbrellaEvents,
  onOpenUmbrella,
  previewMode = false,
  markerPreview,
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
    if (!open || !event || previewMode) return;
    trackEvent("event_detail_open");
    trackEventView(event.id).catch(() => {});
  }, [open, event, previewMode]);

  if (!event) return null;
  const cat = categoryOf(event.category);
  const umbrella = event.umbrellaEventId
    ? umbrellaEvents.find((u) => u.id === event.umbrellaEventId)
    : undefined;

  const description =
    !descriptionExpanded && event.description.length > DESCRIPTION_TRUNCATE_LENGTH
      ? event.description.slice(0, DESCRIPTION_TRUNCATE_LENGTH) + "…"
      : event.description;

  const scheduleRows = dateRangeArray(event.startDate, event.endDate).map((date) => {
    const times = event.dailyTimes?.[date] ?? { startTime: event.startTime, endTime: event.endTime };
    return { date, label: formatDayLabel(date), ...times };
  });

  async function handleInterest() {
    setInterest((n) => n + 1);
    if (previewMode) return;
    trackEvent("event_interest_click");
    try {
      await incrementEventInterest(event!.id);
    } catch {
      setInterest((n) => Math.max(0, n - 1));
    }
  }

  async function handleToggleSave() {
    if (previewMode) {
      setSaved((s) => !s);
      return;
    }
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
    if (!previewMode) incrementEventClicks(event!.id).catch(() => {});
    window.open(event!.websiteUrl, "_blank", "noopener,noreferrer");
  }

  async function handleShare() {
    // Sharing a not-yet-saved draft's URL doesn't make sense — there's no
    // real event page behind it yet.
    if (previewMode) return;
    const usedNativeShare = typeof navigator.share === "function";
    const success = await shareCurrentUrl(event!.title);
    if (!success) return;
    if (!usedNativeShare) showToast("Link gekopieerd.", "success");
    trackEvent("event_share_click");
    incrementEventShares(event!.id).catch(() => {});
  }

  function handleNavigate() {
    trackEvent("navigate_to_event", { event_title: event!.title });
    window.open(buildNavigationUrl(event!.lat, event!.lng, event!.title, window.navigator.userAgent), "_blank");
  }

  return (
    <>
      <Modal
        open={open && !reportModalOpen}
        onClose={onClose}
        title={`${cat.emoji} ${event.title}`}
        variant="detail"
        bareHeader
      >
        <div className={styles.hero}>
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
          {markerPreview && <div className={styles.markerPreviewSlot}>{markerPreview}</div>}
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Sluiten">
            ×
          </button>
        </div>

        <div className={styles.content}>
          <h2 className={styles.title}>
            {cat.emoji} {event.title}
          </h2>

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

          <div className={styles.descriptionCard}>
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
          </div>

          <section className={styles.section}>
            <h3 className={styles.sectionLabel}>📅 Datum &amp; tijden</h3>
            <div className={styles.card}>
              {scheduleRows.map((row) => (
                <div key={row.date} className={styles.scheduleRow}>
                  <span>{row.label}</span>
                  <span>
                    {row.startTime}–{row.endTime}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionLabel}>📍 Locatie</h3>
            <div className={styles.locationCard}>
              <span>{event.address}</span>
              <button type="button" className={styles.navigateLink} onClick={handleNavigate}>
                Navigeer →
              </button>
            </div>
          </section>

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
          <button type="button" className={styles.shareIcon} onClick={handleShare} aria-label="Delen">
            🔗
          </button>
        </div>
        {!previewMode && (
          <div className={styles.secondaryBar}>
            <button type="button" className={styles.reportButton} onClick={() => setReportModalOpen(true)}>
              🚩 Melden
            </button>
          </div>
        )}
        {saveHint && <p className={styles.saveHint}>{saveHint}</p>}
      </Modal>
      {!previewMode && (
        <ReportModal
          open={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          contentType="businessEvent"
          contentId={event.id}
        />
      )}
    </>
  );
}

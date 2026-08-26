"use client";

import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { deleteBusinessEvent } from "@/lib/firebase/businessEvents";
import { createCheckoutSession } from "@/lib/firebase/functions";
import {
  categoryOf,
  formatBusinessEventSchedule,
  businessEventStatusLabel,
  isBusinessEventLive,
} from "@/lib/events/eventHelpers";
import { BusinessEventDetailModal } from "@/components/events/BusinessEventDetailModal";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./InsightsTab.module.css";

interface InsightsTabProps {
  events: BusinessEvent[];
  umbrellaEvents: UmbrellaEvent[];
  onCreate: () => void;
  onEdit: (event: BusinessEvent) => void;
  onDuplicate: (event: BusinessEvent) => void;
}

type EventFilter = "all" | "live" | "pending" | "rejected";

export function InsightsTab({ events, umbrellaEvents, onCreate, onEdit, onDuplicate }: InsightsTabProps) {
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [detailEvent, setDetailEvent] = useState<BusinessEvent | null>(null);

  async function handleDelete(eventId: string) {
    setError(null);
    try {
      await deleteBusinessEvent(eventId);
      showToast("Evenement verwijderd.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  }

  async function handlePay(eventId: string) {
    setError(null);
    try {
      const url = await createCheckoutSession(eventId);
      // A real cross-origin redirect to Stripe's hosted Checkout page, not
      // client-side routing — the toast for a successful payment happens on
      // return (see the ?payment=success handling on the event page), not
      // here, since the payment isn't actually confirmed until Stripe's
      // webhook fires.
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Betalen mislukt.");
    }
  }

  // Newest first, matching the prototype's getMyDashboardEvents() —
  // Firestore's onSnapshot order is otherwise unspecified without an
  // explicit orderBy.
  const sortedEvents = [...events].sort(
    (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
  );
  const liveEventsCount = sortedEvents.filter(isBusinessEventLive).length;
  const totalViews = sortedEvents.reduce((sum, e) => sum + (e.views ?? 0), 0);
  const totalClicks = sortedEvents.reduce((sum, e) => sum + (e.clicks ?? 0), 0);
  const totalShares = sortedEvents.reduce((sum, e) => sum + (e.shares ?? 0), 0);

  const filterChips: { key: EventFilter; label: string }[] = [
    { key: "all", label: `Alles (${sortedEvents.length})` },
    { key: "live", label: `Live (${sortedEvents.filter(isBusinessEventLive).length})` },
    { key: "pending", label: `In afwachting (${sortedEvents.filter((e) => e.status === "pending").length})` },
    { key: "rejected", label: `Afgewezen (${sortedEvents.filter((e) => e.status === "rejected").length})` },
  ];
  const visibleEvents = sortedEvents.filter((e) => {
    if (eventFilter === "live") return isBusinessEventLive(e);
    if (eventFilter === "pending") return e.status === "pending";
    if (eventFilter === "rejected") return e.status === "rejected";
    return true;
  });

  return (
    <>
      <div className={styles.kpiStrip}>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{liveEventsCount}</span>
          <span className={styles.kpiLabel}>Live events</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{totalViews}</span>
          <span className={styles.kpiLabel}>Views totaal</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{totalClicks}</span>
          <span className={styles.kpiLabel}>Klikken totaal</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{totalShares}</span>
          <span className={styles.kpiLabel}>Shares totaal</span>
        </div>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.listHeader}>
        <h2>Mijn events</h2>
        <button type="button" className={styles.newEventButton} onClick={onCreate}>
          + Nieuw evenement
        </button>
      </div>

      {sortedEvents.length > 0 && (
        <div className={styles.filterChips}>
          {filterChips.map((chip) => (
            <button
              type="button"
              key={chip.key}
              className={eventFilter === chip.key ? styles.filterChipActive : styles.filterChip}
              onClick={() => setEventFilter(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <div className={styles.events}>
        {sortedEvents.length === 0 ? (
          <p className={styles.empty}>Nog geen evenementen. Klik op &quot;Nieuw evenement&quot; om te beginnen.</p>
        ) : visibleEvents.length === 0 ? (
          <p className={styles.empty}>Geen events in dit filter.</p>
        ) : (
          visibleEvents.map((ev) => {
            const cat = categoryOf(ev.category);
            return (
              <div key={ev.id} className={styles.eventItem}>
                <div className={styles.eventHeader}>
                  <button type="button" className={styles.eventTitle} onClick={() => setDetailEvent(ev)}>
                    {cat.emoji} {ev.title}
                  </button>
                  <span className={styles.statusBadge}>{businessEventStatusLabel(ev.status)}</span>
                </div>
                <div className={styles.eventMeta}>
                  {formatBusinessEventSchedule(ev)} · {ev.address}
                </div>
                {ev.status === "rejected" && ev.rejectionReason && (
                  <div className={styles.rejectionReason}>Reden voor afwijzing: {ev.rejectionReason}</div>
                )}
                <div className={styles.eventStats}>
                  👁️ {ev.views ?? 0} · 🔗 {ev.clicks ?? 0} · ❤️ {ev.interest ?? 0} · 📤 {ev.shares ?? 0}
                </div>
                <div className={styles.eventActions}>
                  <button type="button" onClick={() => onEdit(ev)}>
                    Bewerken
                  </button>
                  <button type="button" onClick={() => onDuplicate(ev)}>
                    Dupliceren
                  </button>
                  <button type="button" className={styles.deleteButton} onClick={() => handleDelete(ev.id)}>
                    Verwijderen
                  </button>
                  {ev.status === "pending" && !ev.paid && (
                    <button type="button" onClick={() => handlePay(ev.id)}>
                      Betalen
                    </button>
                  )}
                  {ev.paid && <span className={styles.paidLabel}>✅ Betaald, live op de kaart</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      <BusinessEventDetailModal
        open={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        event={detailEvent}
        umbrellaEvents={umbrellaEvents}
      />
    </>
  );
}

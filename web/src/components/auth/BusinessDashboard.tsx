"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { signOutCurrentUser } from "@/lib/firebase/auth";
import { subscribeMyBusinessEvents, deleteBusinessEvent } from "@/lib/firebase/businessEvents";
import { subscribeUmbrellaEvents } from "@/lib/firebase/umbrellaEvents";
import { confirmEventPaymentStub } from "@/lib/firebase/functions";
import { categoryOf, formatBusinessEventSchedule, businessEventStatusLabel } from "@/lib/events/eventHelpers";
import { BusinessEventFormModal } from "@/components/events/BusinessEventFormModal";
import { BusinessEventDetailModal } from "@/components/events/BusinessEventDetailModal";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./BusinessDashboard.module.css";

interface BusinessDashboardProps {
  open: boolean;
  onClose: () => void;
}

export function BusinessDashboard({ open, onClose }: BusinessDashboardProps) {
  const { currentBusiness } = useAuth();
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [umbrellas, setUmbrellas] = useState<UmbrellaEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BusinessEvent | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<BusinessEvent | null>(null);
  const [detailEvent, setDetailEvent] = useState<BusinessEvent | null>(null);

  useEffect(() => {
    if (!open || !currentBusiness) return;
    const unsubEvents = subscribeMyBusinessEvents(currentBusiness.uid, setEvents, (err) =>
      setError(err.message),
    );
    const unsubUmbrellas = subscribeUmbrellaEvents(setUmbrellas);
    return () => {
      unsubEvents();
      unsubUmbrellas();
    };
  }, [open, currentBusiness]);

  async function handleLogout() {
    await signOutCurrentUser();
    onClose();
  }

  function openCreateForm() {
    setEditingEvent(null);
    setDuplicateFrom(null);
    setFormOpen(true);
  }

  function openEditForm(ev: BusinessEvent) {
    setEditingEvent(ev);
    setDuplicateFrom(null);
    setFormOpen(true);
  }

  function openDuplicateForm(ev: BusinessEvent) {
    setEditingEvent(null);
    setDuplicateFrom(ev);
    setFormOpen(true);
  }

  async function handleDelete(eventId: string) {
    setError(null);
    try {
      await deleteBusinessEvent(eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  }

  async function handlePayMock(eventId: string) {
    setError(null);
    try {
      await confirmEventPaymentStub(eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Betalen mislukt.");
    }
  }

  if (!currentBusiness) return null;

  const liveEventsCount = events.filter((e) => e.status === "approved").length;
  const totalViews = events.reduce((sum, e) => sum + (e.views ?? 0), 0);
  const totalClicks = events.reduce((sum, e) => sum + (e.clicks ?? 0), 0);

  return (
    <>
      <Modal open={open && !formOpen && !detailEvent} onClose={onClose} title={currentBusiness.businessName}>
        <p className={styles.email}>{currentBusiness.email}</p>

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
        </div>

        <button type="button" className={styles.newEventButton} onClick={openCreateForm}>
          + Nieuw evenement
        </button>

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.events}>
          {events.length === 0 ? (
            <p className={styles.empty}>Nog geen evenementen. Klik op &quot;Nieuw evenement&quot; om te beginnen.</p>
          ) : (
            events.map((ev) => {
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
                  <div className={styles.eventStats}>
                    👁️ {ev.views ?? 0} · 🔗 {ev.clicks ?? 0} · ❤️ {ev.interest ?? 0}
                  </div>
                  <div className={styles.eventActions}>
                    <button type="button" onClick={() => openEditForm(ev)}>
                      Bewerken
                    </button>
                    <button type="button" onClick={() => openDuplicateForm(ev)}>
                      Dupliceren
                    </button>
                    <button type="button" className={styles.deleteButton} onClick={() => handleDelete(ev.id)}>
                      Verwijderen
                    </button>
                    {ev.status === "approved" && !ev.paid && (
                      <button type="button" onClick={() => handlePayMock(ev.id)}>
                        Nu betalen (mock)
                      </button>
                    )}
                    {ev.paid && <span className={styles.paidLabel}>✅ Betaald, live op de kaart</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <button type="button" onClick={handleLogout}>
          Uitloggen
        </button>
        <button type="button" onClick={onClose}>
          Sluiten
        </button>
      </Modal>

      <BusinessEventFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        ownerId={currentBusiness.uid}
        editingEvent={editingEvent}
        duplicateFrom={duplicateFrom}
        umbrellaEvents={umbrellas}
      />

      <BusinessEventDetailModal
        open={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        event={detailEvent}
        umbrellaEvents={umbrellas}
      />
    </>
  );
}

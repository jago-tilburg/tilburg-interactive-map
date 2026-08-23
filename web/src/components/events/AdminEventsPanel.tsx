"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { subscribeAllBusinessEventsForAdmin } from "@/lib/firebase/businessEvents";
import { subscribeUmbrellaEvents, deleteUmbrellaEvent } from "@/lib/firebase/umbrellaEvents";
import { approveEvent, rejectEvent } from "@/lib/firebase/functions";
import { categoryOf, formatBusinessEventSchedule, businessEventStatusLabel } from "@/lib/events/eventHelpers";
import { UmbrellaFormModal } from "./UmbrellaFormModal";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./AdminEventsPanel.module.css";

interface AdminEventsPanelProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "businessEvents" | "umbrellaEvents";

export function AdminEventsPanel({ open, onClose }: AdminEventsPanelProps) {
  const [tab, setTab] = useState<Tab>("businessEvents");
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [umbrellas, setUmbrellas] = useState<UmbrellaEvent[]>([]);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [umbrellaFormOpen, setUmbrellaFormOpen] = useState(false);
  const [editingUmbrella, setEditingUmbrella] = useState<UmbrellaEvent | null>(null);

  useEffect(() => {
    if (!open) return;
    const unsubEvents = subscribeAllBusinessEventsForAdmin(setEvents, (err) => setError(err.message));
    const unsubUmbrellas = subscribeUmbrellaEvents(setUmbrellas, (err) => setError(err.message));
    return () => {
      unsubEvents();
      unsubUmbrellas();
    };
  }, [open]);

  async function handleApprove(eventId: string) {
    setBusyEventId(eventId);
    setError(null);
    try {
      await approveEvent(eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Goedkeuren mislukt.");
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleReject(eventId: string) {
    setBusyEventId(eventId);
    setError(null);
    try {
      await rejectEvent(eventId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Afwijzen mislukt.");
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleDeleteUmbrella(umbrellaId: string) {
    setError(null);
    try {
      await deleteUmbrellaEvent(umbrellaId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  }

  const pendingCount = events.filter((e) => e.status === "pending").length;

  return (
    <>
      <Modal open={open && !umbrellaFormOpen} onClose={onClose} title="Admin — Evenementen">
        <div className={styles.tabs}>
          <button
            type="button"
            className={tab === "businessEvents" ? styles.tabActive : styles.tab}
            onClick={() => setTab("businessEvents")}
          >
            🎉 Bedrijfsevents ({pendingCount})
          </button>
          <button
            type="button"
            className={tab === "umbrellaEvents" ? styles.tabActive : styles.tab}
            onClick={() => setTab("umbrellaEvents")}
          >
            🎪 Grote evenementen ({umbrellas.length})
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {tab === "businessEvents" ? (
          events.length === 0 ? (
            <p className={styles.empty}>Nog geen bedrijfsevenementen.</p>
          ) : (
            <div className={styles.list}>
              {events.map((ev) => {
                const cat = categoryOf(ev.category);
                return (
                  <div key={ev.id} className={styles.row}>
                    <div>
                      <div className={styles.rowTitle}>
                        {cat.emoji} {ev.title}
                        <span className={styles.status}>{businessEventStatusLabel(ev.status)}</span>
                      </div>
                      <div className={styles.rowMeta}>
                        {formatBusinessEventSchedule(ev)} · {ev.address}
                      </div>
                    </div>
                    {ev.status === "pending" && (
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          disabled={busyEventId === ev.id}
                          onClick={() => handleApprove(ev.id)}
                        >
                          Goedkeuren
                        </button>
                        <button
                          type="button"
                          disabled={busyEventId === ev.id}
                          onClick={() => handleReject(ev.id)}
                        >
                          Afwijzen
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className={styles.list}>
            <button
              type="button"
              className={styles.addButton}
              onClick={() => {
                setEditingUmbrella(null);
                setUmbrellaFormOpen(true);
              }}
            >
              + Groot evenement toevoegen
            </button>
            {umbrellas.map((u) => (
              <div key={u.id} className={styles.row}>
                <div>
                  <div className={styles.rowTitle}>
                    🎪 {u.title}
                  </div>
                  <div className={styles.rowMeta}>
                    {u.startDate} t/m {u.endDate}
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUmbrella(u);
                      setUmbrellaFormOpen(true);
                    }}
                  >
                    Bewerken
                  </button>
                  <button type="button" onClick={() => handleDeleteUmbrella(u.id)}>
                    Verwijderen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <UmbrellaFormModal
        open={umbrellaFormOpen}
        onClose={() => setUmbrellaFormOpen(false)}
        editingUmbrella={editingUmbrella}
      />
    </>
  );
}

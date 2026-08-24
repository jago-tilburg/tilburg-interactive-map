"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { subscribeShops, deleteShop, getShopViews } from "@/lib/firebase/shops";
import { subscribeRequests, deleteRequest } from "@/lib/firebase/requests";
import { subscribeAllBusinessEventsForAdmin, deleteBusinessEvent } from "@/lib/firebase/businessEvents";
import { subscribeUmbrellaEvents, deleteUmbrellaEvent } from "@/lib/firebase/umbrellaEvents";
import { approveEvent, rejectEvent } from "@/lib/firebase/functions";
import { categoryOf, formatBusinessEventSchedule, businessEventStatusLabel } from "@/lib/events/eventHelpers";
import { ShopFormModal } from "@/components/shops/ShopFormModal";
import { UmbrellaFormModal } from "@/components/events/UmbrellaFormModal";
import { BusinessEventFormModal } from "@/components/events/BusinessEventFormModal";
import type { Shop } from "@/types/shops";
import type { ShopRequest } from "@/types/requests";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./AdminPanel.module.css";

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "shops" | "userRatings" | "requests" | "businessEvents" | "umbrellaEvents";

export function AdminPanel({ open, onClose }: AdminPanelProps) {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("shops");
  const [shops, setShops] = useState<Shop[]>([]);
  const [requests, setRequests] = useState<ShopRequest[]>([]);
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [umbrellas, setUmbrellas] = useState<UmbrellaEvent[]>([]);
  const [viewCounts, setViewCounts] = useState<Record<number, number>>({});
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shopFormOpen, setShopFormOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [umbrellaFormOpen, setUmbrellaFormOpen] = useState(false);
  const [editingUmbrella, setEditingUmbrella] = useState<UmbrellaEvent | null>(null);
  const [quickEventFormOpen, setQuickEventFormOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const unsubShops = subscribeShops(setShops, (err) => setError(err.message));
    const unsubRequests = subscribeRequests(setRequests, (err) => setError(err.message));
    const unsubEvents = subscribeAllBusinessEventsForAdmin(setEvents, (err) => setError(err.message));
    const unsubUmbrellas = subscribeUmbrellaEvents(setUmbrellas, (err) => setError(err.message));
    return () => {
      unsubShops();
      unsubRequests();
      unsubEvents();
      unsubUmbrellas();
    };
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "shops") return;
    let cancelled = false;
    Promise.all(shops.map((s) => getShopViews(s.id).then((count) => [s.id, count] as const))).then(
      (entries) => {
        if (!cancelled) setViewCounts(Object.fromEntries(entries));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, tab, shops]);

  async function handleDeleteShop(shopId: number) {
    setError(null);
    try {
      await deleteShop(shopId);
      showToast("Review verwijderd.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  }

  async function handleDeleteRequest(firebaseKey: string) {
    setError(null);
    try {
      await deleteRequest(firebaseKey);
      showToast("Aanvraag verwijderd.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  }

  async function handleApprove(eventId: string) {
    setBusyEventId(eventId);
    setError(null);
    try {
      await approveEvent(eventId);
      showToast("Evenement goedgekeurd.", "success");
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
      showToast("Evenement afgewezen.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Afwijzen mislukt.");
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    setError(null);
    try {
      await deleteBusinessEvent(eventId);
      showToast("Evenement verwijderd.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  }

  async function handleDeleteUmbrella(umbrellaId: string) {
    setError(null);
    try {
      await deleteUmbrellaEvent(umbrellaId);
      showToast("Groot evenement verwijderd.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  }

  const pendingCount = events.filter((e) => e.status === "pending").length;
  const allRatings = shops.flatMap((shop) =>
    (shop.userRatings ?? []).map((r) => ({ shopName: shop.name, ...r })),
  );
  const sortedRequests = [...requests].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const sortedUmbrellas = [...umbrellas].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <>
      <Modal
        open={open && !shopFormOpen && !umbrellaFormOpen && !quickEventFormOpen}
        onClose={onClose}
        title="Beheerpaneel"
      >
        <div className={styles.tabs}>
          <button type="button" className={tab === "shops" ? styles.tabActive : styles.tab} onClick={() => setTab("shops")}>
            Reviews ({shops.length})
          </button>
          <button
            type="button"
            className={tab === "userRatings" ? styles.tabActive : styles.tab}
            onClick={() => setTab("userRatings")}
          >
            ⭐ User Ratings ({allRatings.length})
          </button>
          <button
            type="button"
            className={tab === "requests" ? styles.tabActive : styles.tab}
            onClick={() => setTab("requests")}
          >
            🥪 Aanvragen ({requests.length})
          </button>
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

        {tab === "shops" && (
          <div className={styles.list}>
            <button
              type="button"
              className={styles.addButton}
              onClick={() => {
                setEditingShop(null);
                setShopFormOpen(true);
              }}
            >
              + Nieuwe Review Toevoegen
            </button>
            {shops.map((shop) => (
              <div key={shop.id} className={styles.row}>
                <div>
                  <div className={styles.rowTitle}>{shop.name}</div>
                  <div className={styles.rowMeta}>
                    {shop.address} · {shop.rating} ⭐ · {shop.price} · 👁️ {viewCounts[shop.id] ?? 0}
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingShop(shop);
                      setShopFormOpen(true);
                    }}
                  >
                    Bewerken
                  </button>
                  <button type="button" onClick={() => handleDeleteShop(shop.id)}>
                    Verwijderen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "userRatings" &&
          (allRatings.length === 0 ? (
            <p className={styles.empty}>Nog geen ratings van gebruikers ⭐</p>
          ) : (
            <div className={styles.list}>
              {allRatings.map((r, i) => (
                <div key={i} className={styles.row}>
                  <div>
                    <div className={styles.rowTitle}>{r.shopName}</div>
                    <div className={styles.rowMeta}>
                      {r.userId.substring(0, 8)}... · {r.rating} ⭐
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {tab === "requests" &&
          (sortedRequests.length === 0 ? (
            <p className={styles.empty}>Nog geen aanvragen 🥪</p>
          ) : (
            <div className={styles.list}>
              {sortedRequests.map((r) => (
                <div key={r.firebaseKey} className={styles.row}>
                  <div>
                    <div className={styles.rowTitle}>{r.shopName}</div>
                    <div className={styles.rowMeta}>{new Date(r.createdAt).toLocaleDateString("nl-NL")}</div>
                  </div>
                  <div className={styles.rowActions}>
                    <button type="button" onClick={() => handleDeleteRequest(r.firebaseKey)}>
                      Verwijderen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {tab === "businessEvents" && (
          <div className={styles.list}>
            {currentUser && (
              <button type="button" className={styles.addButton} onClick={() => setQuickEventFormOpen(true)}>
                + Snel evenement toevoegen
              </button>
            )}
            {events.length === 0 ? (
              <p className={styles.empty}>Nog geen bedrijfsevenementen.</p>
            ) : (
              events.map((ev) => {
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
                    <div className={styles.rowActions}>
                      {ev.status === "pending" ? (
                        <>
                          <button type="button" disabled={busyEventId === ev.id} onClick={() => handleApprove(ev.id)}>
                            Goedkeuren
                          </button>
                          <button type="button" disabled={busyEventId === ev.id} onClick={() => handleReject(ev.id)}>
                            Afwijzen
                          </button>
                        </>
                      ) : (
                        // Matches the prototype's admin events tab, where approved/rejected
                        // events still get a delete action (only pending gets approve/reject).
                        <button type="button" onClick={() => handleDeleteEvent(ev.id)}>
                          Verwijderen
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "umbrellaEvents" && (
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
            {sortedUmbrellas.map((u) => (
              <div key={u.id} className={styles.row}>
                <div>
                  <div className={styles.rowTitle}>🎪 {u.title}</div>
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

      <ShopFormModal open={shopFormOpen} onClose={() => setShopFormOpen(false)} editingShop={editingShop} />
      <UmbrellaFormModal
        open={umbrellaFormOpen}
        onClose={() => setUmbrellaFormOpen(false)}
        editingUmbrella={editingUmbrella}
      />
      {currentUser && (
        // Folds the legacy RTDB `events` domain into businessEvents rather than
        // maintaining two parallel event systems — see the master plan's own
        // "revisit once the new events UI exists" note. There was no existing
        // data in the legacy node to migrate. Firestore rules require every
        // client-created event to start 'pending' (even an admin's), so this
        // still needs a follow-up "Goedkeuren" click — it lands in the same
        // pending list above, not auto-approved.
        <BusinessEventFormModal
          open={quickEventFormOpen}
          onClose={() => setQuickEventFormOpen(false)}
          ownerId={currentUser.uid}
          editingEvent={null}
          umbrellaEvents={umbrellas}
        />
      )}
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { subscribeShops, deleteShop, getShopViews } from "@/lib/firebase/shops";
import { subscribeRequests, deleteRequest } from "@/lib/firebase/requests";
import { subscribeAllBusinessEventsForAdmin } from "@/lib/firebase/businessEvents";
import { subscribeUmbrellaEvents, deleteUmbrellaEvent } from "@/lib/firebase/umbrellaEvents";
import { suspendEvent, restoreEvent, blockEvent, adminDeleteEvent } from "@/lib/firebase/functions";
import { subscribeAllReportsForAdmin, resolveReport, dismissReport } from "@/lib/firebase/reports";
import { categoryOf, formatBusinessEventSchedule, businessEventStatusLabel } from "@/lib/events/eventHelpers";
import { ShopFormModal } from "@/components/shops/ShopFormModal";
import { UmbrellaFormModal } from "@/components/events/UmbrellaFormModal";
import { BusinessEventFormModal } from "@/components/events/BusinessEventFormModal";
import type { Shop } from "@/types/shops";
import type { ShopRequest } from "@/types/requests";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import type { Report, ReportContentType, ReportReason } from "@/types/reports";
import styles from "./AdminPanel.module.css";

interface AdminPanelProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "shops" | "userRatings" | "requests" | "businessEvents" | "umbrellaEvents" | "reports";

const REPORT_CONTENT_TYPE_LABEL: Record<ReportContentType, string> = {
  shop: "Winkel",
  businessEvent: "Evenement",
  comment: "Reactie",
  review: "Review",
  shopPhoto: "Winkelfoto",
  eventPhoto: "Evenementfoto",
};

const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  spam: "Spam",
  offensive: "Aanstootgevend",
  incorrect_info: "Onjuiste informatie",
  other: "Anders",
};

// The two moderation actions that take an optional free-text reason share
// one confirm-with-reason prompt in the UI below, rather than two
// near-identical copies of it.
type ReasonActionKind = "suspend" | "block";

const REASON_ACTIONS: Record<
  ReasonActionKind,
  {
    call: (eventId: string, reason?: string) => Promise<unknown>;
    label: string;
    confirmLabel: string;
    successToast: string;
    errorFallback: string;
  }
> = {
  suspend: {
    call: suspendEvent,
    label: "Reden voor opschorten",
    confirmLabel: "Opschorten bevestigen",
    successToast: "Evenement opgeschort.",
    errorFallback: "Opschorten mislukt.",
  },
  block: {
    call: blockEvent,
    label: "Reden voor blokkeren",
    confirmLabel: "Blokkeren bevestigen",
    successToast: "Evenement geblokkeerd.",
    errorFallback: "Blokkeren mislukt.",
  },
};

export function AdminPanel({ open, onClose }: AdminPanelProps) {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("shops");
  const [shops, setShops] = useState<Shop[]>([]);
  const [requests, setRequests] = useState<ShopRequest[]>([]);
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [umbrellas, setUmbrellas] = useState<UmbrellaEvent[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [viewCounts, setViewCounts] = useState<Record<number, number>>({});
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ eventId: string; kind: ReasonActionKind } | null>(null);
  const [actionReason, setActionReason] = useState("");
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
    const unsubReports = subscribeAllReportsForAdmin(setReports, (err) => setError(err.message));
    return () => {
      unsubShops();
      unsubRequests();
      unsubReports();
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

  async function handleConfirmReasonAction() {
    if (!pendingAction) return;
    const { eventId, kind } = pendingAction;
    const cfg = REASON_ACTIONS[kind];
    setBusyEventId(eventId);
    setError(null);
    try {
      await cfg.call(eventId, actionReason.trim() || undefined);
      showToast(cfg.successToast, "success");
      setPendingAction(null);
      setActionReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : cfg.errorFallback);
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleRestore(eventId: string) {
    setBusyEventId(eventId);
    setError(null);
    try {
      await restoreEvent(eventId);
      showToast("Evenement hersteld.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Herstellen mislukt.");
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    setError(null);
    try {
      await adminDeleteEvent(eventId);
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

  async function handleResolveReport(reportId: string) {
    if (!currentUser) return;
    setError(null);
    try {
      await resolveReport(reportId, currentUser.uid);
      showToast("Melding afgehandeld.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Afhandelen mislukt.");
    }
  }

  async function handleDismissReport(reportId: string) {
    if (!currentUser) return;
    setError(null);
    try {
      await dismissReport(reportId, currentUser.uid);
      showToast("Melding genegeerd.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Negeren mislukt.");
    }
  }

  const openReports = reports.filter((r) => r.status === "open");
  const allRatings = shops.flatMap((shop) =>
    (shop.userRatings ?? []).map((r) => ({ shopName: shop.name, ...r })),
  );
  const sortedRequests = [...requests].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const sortedUmbrellas = [...umbrellas].sort((a, b) => a.startDate.localeCompare(b.startDate));
  // Open reports first, newest first within each group.
  const sortedReports = [...reports].sort((a, b) => {
    if (a.status === "open" && b.status !== "open") return -1;
    if (a.status !== "open" && b.status === "open") return 1;
    const aTime = a.createdAt && "toMillis" in a.createdAt ? a.createdAt.toMillis() : 0;
    const bTime = b.createdAt && "toMillis" in b.createdAt ? b.createdAt.toMillis() : 0;
    return bTime - aTime;
  });

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
            🎉 Bedrijfsevents ({events.length})
          </button>
          <button
            type="button"
            className={tab === "umbrellaEvents" ? styles.tabActive : styles.tab}
            onClick={() => setTab("umbrellaEvents")}
          >
            🎪 Grote evenementen ({umbrellas.length})
          </button>
          <button
            type="button"
            className={tab === "reports" ? styles.tabActive : styles.tab}
            onClick={() => setTab("reports")}
          >
            🚩 Meldingen ({openReports.length})
          </button>
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}

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
                      {ev.status === "rejected" && ev.rejectionReason && (
                        <div className={styles.rejectionReason}>Reden: {ev.rejectionReason}</div>
                      )}
                      {(ev.status === "suspended" || ev.status === "blocked") && ev.moderationReason && (
                        <div className={styles.rejectionReason}>Reden: {ev.moderationReason}</div>
                      )}
                    </div>
                    {pendingAction?.eventId === ev.id ? (
                      <div className={styles.rejectPrompt}>
                        <textarea
                          aria-label={REASON_ACTIONS[pendingAction.kind].label}
                          placeholder={`${REASON_ACTIONS[pendingAction.kind].label} (optioneel)`}
                          value={actionReason}
                          onChange={(e) => setActionReason(e.target.value)}
                        />
                        <div className={styles.rowActions}>
                          <button type="button" disabled={busyEventId === ev.id} onClick={handleConfirmReasonAction}>
                            {REASON_ACTIONS[pendingAction.kind].confirmLabel}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingAction(null);
                              setActionReason("");
                            }}
                          >
                            Annuleren
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.rowActions}>
                        {ev.status === "approved" && (
                          <>
                            <button
                              type="button"
                              disabled={busyEventId === ev.id}
                              onClick={() => setPendingAction({ eventId: ev.id, kind: "suspend" })}
                            >
                              Opschorten
                            </button>
                            <button
                              type="button"
                              disabled={busyEventId === ev.id}
                              onClick={() => setPendingAction({ eventId: ev.id, kind: "block" })}
                            >
                              Blokkeren
                            </button>
                            <button type="button" onClick={() => handleDeleteEvent(ev.id)}>
                              Verwijderen
                            </button>
                          </>
                        )}
                        {ev.status === "suspended" && (
                          <>
                            <button type="button" disabled={busyEventId === ev.id} onClick={() => handleRestore(ev.id)}>
                              Herstellen
                            </button>
                            <button
                              type="button"
                              disabled={busyEventId === ev.id}
                              onClick={() => setPendingAction({ eventId: ev.id, kind: "block" })}
                            >
                              Blokkeren
                            </button>
                            <button type="button" onClick={() => handleDeleteEvent(ev.id)}>
                              Verwijderen
                            </button>
                          </>
                        )}
                        {(ev.status === "pending" || ev.status === "rejected" || ev.status === "blocked") && (
                          // pending: unpaid, nothing to approve/reject any more (paying
                          // publishes it directly) — just lets admin clean up junk
                          // submissions. rejected/blocked: matches the prototype's admin
                          // events tab, still get a delete action.
                          <button type="button" onClick={() => handleDeleteEvent(ev.id)}>
                            Verwijderen
                          </button>
                        )}
                      </div>
                    )}
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

        {tab === "reports" &&
          (sortedReports.length === 0 ? (
            <p className={styles.empty}>Nog geen meldingen 🚩</p>
          ) : (
            <div className={styles.list}>
              {sortedReports.map((r) => (
                <div key={r.id} className={styles.row}>
                  <div>
                    <div className={styles.rowTitle}>
                      {REPORT_CONTENT_TYPE_LABEL[r.contentType]} · {REPORT_REASON_LABEL[r.reason]}
                      {r.status !== "open" && (
                        <span className={styles.status}>
                          {r.status === "resolved" ? "Afgehandeld" : "Genegeerd"}
                        </span>
                      )}
                    </div>
                    <div className={styles.rowMeta}>
                      contentId: {r.contentId}
                      {r.parentId && ` · bij ${r.parentId}`}
                    </div>
                    {r.details && <div className={styles.rejectionReason}>{r.details}</div>}
                  </div>
                  {r.status === "open" && (
                    <div className={styles.rowActions}>
                      <button type="button" onClick={() => handleResolveReport(r.id)}>
                        Afhandelen
                      </button>
                      <button type="button" onClick={() => handleDismissReport(r.id)}>
                        Negeren
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
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

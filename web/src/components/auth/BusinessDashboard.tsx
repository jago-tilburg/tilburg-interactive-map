"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { signOutCurrentUser, deleteCurrentUser, changeBusinessPassword } from "@/lib/firebase/auth";
import { deleteBusinessAccountCascade, updateBusinessProfile } from "@/lib/firebase/firestore";
import { subscribeMyBusinessEvents, deleteBusinessEvent } from "@/lib/firebase/businessEvents";
import { subscribeUmbrellaEvents } from "@/lib/firebase/umbrellaEvents";
import { confirmEventPaymentStub } from "@/lib/firebase/functions";
import { extractCoordsFromMapsUrl } from "@/lib/maps/extractCoordsFromUrl";
import {
  categoryOf,
  formatBusinessEventSchedule,
  businessEventStatusLabel,
  isBusinessEventLive,
} from "@/lib/events/eventHelpers";
import { BusinessEventFormModal } from "@/components/events/BusinessEventFormModal";
import { BusinessEventDetailModal } from "@/components/events/BusinessEventDetailModal";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./BusinessDashboard.module.css";

interface BusinessDashboardProps {
  open: boolean;
  onClose: () => void;
}

export function BusinessDashboard({ open, onClose }: BusinessDashboardProps) {
  const { currentUser, currentBusiness, refreshCurrentBusiness } = useAuth();
  const { showToast } = useToast();
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [umbrellas, setUmbrellas] = useState<UmbrellaEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<BusinessEvent | null>(null);
  const [duplicateFrom, setDuplicateFrom] = useState<BusinessEvent | null>(null);
  const [detailEvent, setDetailEvent] = useState<BusinessEvent | null>(null);
  const [eventFilter, setEventFilter] = useState<"all" | "live" | "pending" | "rejected">("all");

  const [dashTab, setDashTab] = useState<"events" | "settings">("events");
  const [settingsName, setSettingsName] = useState("");
  const [settingsAddress, setSettingsAddress] = useState("");
  const [settingsMapUrl, setSettingsMapUrl] = useState("");
  const [settingsLat, setSettingsLat] = useState<number | null>(null);
  const [settingsLng, setSettingsLng] = useState<number | null>(null);
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState("");
  const [settingsNewPassword, setSettingsNewPassword] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Repopulates the settings form from the current profile each time it
  // becomes the signed-in business — same during-render sync pattern used by
  // this app's other detail modals (e.g. ShopDetailModal's error reset).
  const [settingsSyncedUid, setSettingsSyncedUid] = useState<string | null>(null);
  if (open && currentBusiness && currentBusiness.uid !== settingsSyncedUid) {
    setSettingsSyncedUid(currentBusiness.uid);
    setSettingsName(currentBusiness.businessName);
    setSettingsAddress(currentBusiness.defaultAddress ?? "");
    setSettingsMapUrl("");
    setSettingsLat(currentBusiness.defaultLat ?? null);
    setSettingsLng(currentBusiness.defaultLng ?? null);
    setSettingsCurrentPassword("");
    setSettingsNewPassword("");
  }

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

  async function handleDeleteAccount() {
    if (!currentUser) return;
    setError(null);
    try {
      await deleteBusinessAccountCascade(currentUser.uid);
      await deleteCurrentUser(currentUser);
      showToast("Account verwijderd.", "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account verwijderen mislukt.");
    }
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
      showToast("Evenement verwijderd.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  }

  async function handlePayMock(eventId: string) {
    setError(null);
    try {
      await confirmEventPaymentStub(eventId);
      showToast("Betaald! Je evenement is nu live op de kaart.", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Betalen mislukt.");
    }
  }

  function handleExtractSettingsCoords() {
    const coords = extractCoordsFromMapsUrl(settingsMapUrl);
    if (!coords) {
      setError("Coördinaten niet gevonden");
      return;
    }
    setError(null);
    setSettingsLat(coords.lat);
    setSettingsLng(coords.lng);
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!currentBusiness) return;
    const trimmedName = settingsName.trim();
    if (!trimmedName) {
      setError("Bedrijfsnaam mag niet leeg zijn");
      return;
    }
    setError(null);
    setSettingsSaving(true);
    try {
      await updateBusinessProfile(currentBusiness.uid, {
        businessName: trimmedName,
        defaultAddress: settingsAddress.trim(),
        ...(settingsLat !== null && settingsLng !== null ? { defaultLat: settingsLat, defaultLng: settingsLng } : {}),
      });
      if (settingsNewPassword) {
        if (!currentUser) throw new Error("Niet ingelogd.");
        await changeBusinessPassword(currentUser, settingsCurrentPassword, settingsNewPassword);
      }
      await refreshCurrentBusiness();
      setSettingsCurrentPassword("");
      setSettingsNewPassword("");
      showToast("Instellingen opgeslagen", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setSettingsSaving(false);
    }
  }

  if (!currentBusiness) return null;

  // Newest first, matching the prototype's getMyDashboardEvents() — Firestore's
  // onSnapshot order is otherwise unspecified without an explicit orderBy.
  const sortedEvents = [...events].sort(
    (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
  );
  const liveEventsCount = sortedEvents.filter(isBusinessEventLive).length;
  const totalViews = sortedEvents.reduce((sum, e) => sum + (e.views ?? 0), 0);
  const totalClicks = sortedEvents.reduce((sum, e) => sum + (e.clicks ?? 0), 0);
  const totalShares = sortedEvents.reduce((sum, e) => sum + (e.shares ?? 0), 0);

  const filterChips: { key: typeof eventFilter; label: string }[] = [
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
          <div className={styles.kpi}>
            <span className={styles.kpiValue}>{totalShares}</span>
            <span className={styles.kpiLabel}>Shares totaal</span>
          </div>
        </div>

        <div className={styles.dashTabs}>
          <button
            type="button"
            className={dashTab === "events" ? styles.dashTabActive : styles.dashTab}
            onClick={() => setDashTab("events")}
          >
            Events
          </button>
          <button
            type="button"
            className={dashTab === "settings" ? styles.dashTabActive : styles.dashTab}
            onClick={() => setDashTab("settings")}
          >
            Instellingen
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {dashTab === "events" ? (
          <>
            <button type="button" className={styles.newEventButton} onClick={openCreateForm}>
              + Nieuw evenement
            </button>

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
                        <button type="button" onClick={() => openEditForm(ev)}>
                          Bewerken
                        </button>
                        <button type="button" onClick={() => openDuplicateForm(ev)}>
                          Dupliceren
                        </button>
                        <button type="button" className={styles.deleteButton} onClick={() => handleDelete(ev.id)}>
                          Verwijderen
                        </button>
                        {ev.status === "pending" && !ev.paid && (
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
          </>
        ) : (
          <form className={styles.settingsForm} onSubmit={handleSaveSettings}>
            <label htmlFor="biz-settings-name">Bedrijfsnaam</label>
            <input
              id="biz-settings-name"
              type="text"
              value={settingsName}
              onChange={(e) => setSettingsName(e.target.value)}
            />

            <label htmlFor="biz-settings-email">E-mail</label>
            <input id="biz-settings-email" type="email" value={currentBusiness.email} disabled />

            <label htmlFor="biz-settings-map-url">Standaardlocatie (voor nieuwe evenementen)</label>
            <div className={styles.settingsRow}>
              <input
                id="biz-settings-map-url"
                type="text"
                placeholder="Google Maps URL"
                value={settingsMapUrl}
                onChange={(e) => setSettingsMapUrl(e.target.value)}
              />
              <button type="button" onClick={handleExtractSettingsCoords}>
                Extract
              </button>
            </div>
            <input
              type="text"
              placeholder="Adres"
              aria-label="Standaardadres"
              value={settingsAddress}
              onChange={(e) => setSettingsAddress(e.target.value)}
            />

            <label htmlFor="biz-settings-current-password">Huidig wachtwoord</label>
            <input
              id="biz-settings-current-password"
              type="password"
              placeholder="Alleen nodig om je wachtwoord te wijzigen"
              value={settingsCurrentPassword}
              onChange={(e) => setSettingsCurrentPassword(e.target.value)}
            />

            <label htmlFor="biz-settings-new-password">Nieuw wachtwoord</label>
            <input
              id="biz-settings-new-password"
              type="password"
              placeholder="Laat leeg om ongewijzigd te laten"
              value={settingsNewPassword}
              onChange={(e) => setSettingsNewPassword(e.target.value)}
            />

            <button type="submit" disabled={settingsSaving}>
              {settingsSaving ? "Opslaan…" : "Instellingen opslaan"}
            </button>
          </form>
        )}

        <div className={styles.footerActions}>
          <button type="button" onClick={handleLogout}>
            Uitloggen
          </button>
          <button type="button" onClick={onClose}>
            Sluiten
          </button>
          <button type="button" className={styles.deleteButton} onClick={handleDeleteAccount}>
            Account verwijderen
          </button>
        </div>
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

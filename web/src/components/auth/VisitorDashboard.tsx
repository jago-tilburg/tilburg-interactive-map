"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { signOutCurrentUser, deleteCurrentUser, changeAccountPassword } from "@/lib/firebase/auth";
import { subscribeVisitorProfile, deleteAccountCascade, updateMarketingConsent } from "@/lib/firebase/firestore";
import { subscribeShops } from "@/lib/firebase/shops";
import { subscribeApprovedBusinessEvents } from "@/lib/firebase/businessEvents";
import { categoryOf, formatBusinessEventSchedule } from "@/lib/events/eventHelpers";
import type { Visitor } from "@/types/account";
import type { Shop } from "@/types/shops";
import type { BusinessEvent } from "@/types/events";
import styles from "./VisitorDashboard.module.css";

interface VisitorDashboardProps {
  open: boolean;
  onClose: () => void;
  onOpenShop: (shopId: number) => void;
  onOpenEvent: (eventId: string) => void;
}

export function VisitorDashboard({ open, onClose, onOpenShop, onOpenEvent }: VisitorDashboardProps) {
  const { currentUser, currentVisitor, currentBusiness, refreshCurrentVisitor } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [liveVisitor, setLiveVisitor] = useState<Visitor | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [businessEvents, setBusinessEvents] = useState<BusinessEvent[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [consentSaving, setConsentSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (!open || !currentVisitor) return;
    const unsubVisitor = subscribeVisitorProfile(currentVisitor.uid, setLiveVisitor);
    const unsubShops = subscribeShops(setShops);
    const unsubEvents = subscribeApprovedBusinessEvents(setBusinessEvents);
    return () => {
      unsubVisitor();
      unsubShops();
      unsubEvents();
    };
  }, [open, currentVisitor]);

  // Resets the password/error fields the moment the modal closes — during
  // render (not a plain effect calling setState) so it can't cause an extra
  // cascading render, same pattern PostAuthFlow uses for its own open/close
  // sync.
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
  } else if (!open && wasOpen) {
    setWasOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setPasswordError(null);
    setDeleteError(null);
  }

  async function handleLogout() {
    await signOutCurrentUser();
    onClose();
  }

  async function handleDeleteAccount() {
    if (!currentUser) return;
    setDeleteError(null);
    try {
      await deleteAccountCascade(currentUser.uid);
      await deleteCurrentUser(currentUser);
      showToast("Account verwijderd.", "success");
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Account verwijderen mislukt.");
    }
  }

  async function handleToggleConsent(next: boolean) {
    if (!currentVisitor) return;
    setConsentSaving(true);
    try {
      await updateMarketingConsent(currentVisitor.uid, next);
      await refreshCurrentVisitor(currentVisitor.uid);
    } catch {
      showToast("Wijzigen van toestemming mislukt.", "error");
    } finally {
      setConsentSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setPasswordError(null);
    setPasswordSaving(true);
    try {
      await changeAccountPassword(currentUser, currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      showToast("Wachtwoord gewijzigd.", "success");
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      setPasswordError(
        code === "auth/wrong-password" || code === "auth/invalid-credential"
          ? "Huidig wachtwoord is onjuist."
          : err instanceof Error
            ? err.message
            : "Wachtwoord wijzigen mislukt.",
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  function handleGoToBusiness() {
    onClose();
    router.push("/bedrijf");
  }

  if (!currentVisitor) return null;

  const uid = currentVisitor.uid;
  const likedShops = shops.filter((s) => s.likes?.includes(uid));
  const ratedShops = shops
    .map((s) => ({ shop: s, rating: s.userRatings?.find((r) => r.userId === uid)?.rating }))
    .filter((entry): entry is { shop: Shop; rating: number } => entry.rating !== undefined);
  const savedEventIds = liveVisitor?.savedEventIds ?? currentVisitor.savedEventIds ?? [];
  const savedEvents = businessEvents.filter((e) => savedEventIds.includes(e.id));
  const marketingConsent = liveVisitor?.marketingConsent ?? currentVisitor.marketingConsent ?? false;

  return (
    <Modal open={open} onClose={onClose} title="Mijn account">
      <p className={styles.email}>{currentVisitor.email}</p>

      {currentBusiness && (
        <div className={styles.section}>
          <button type="button" className={styles.businessLink} onClick={handleGoToBusiness}>
            🏢 Naar je bedrijfsomgeving
          </button>
        </div>
      )}

      <div className={styles.section}>
        <h3>🔖 Bewaarde evenementen</h3>
        {savedEvents.length === 0 ? (
          <p className={styles.empty}>Nog geen evenementen bewaard.</p>
        ) : (
          <ul className={styles.list}>
            {savedEvents.map((e) => (
              <li key={e.id}>
                <button type="button" className={styles.listItem} onClick={() => onOpenEvent(e.id)}>
                  {categoryOf(e.category).emoji} {e.title} — {formatBusinessEventSchedule(e)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <h3>❤️ Geliked</h3>
        {likedShops.length === 0 ? (
          <p className={styles.empty}>Nog geen shops geliked.</p>
        ) : (
          <ul className={styles.list}>
            {likedShops.map((s) => (
              <li key={s.id}>
                <button type="button" className={styles.listItem} onClick={() => onOpenShop(s.id)}>
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <h3>⭐ Mijn ratings</h3>
        {ratedShops.length === 0 ? (
          <p className={styles.empty}>Nog geen ratings gegeven.</p>
        ) : (
          <ul className={styles.list}>
            {ratedShops.map(({ shop, rating }) => (
              <li key={shop.id}>
                <button type="button" className={styles.listItem} onClick={() => onOpenShop(shop.id)}>
                  {shop.name} — {rating.toFixed(1)} ⭐
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <h3>Instellingen</h3>
        <label className={styles.consentRow}>
          <input
            type="checkbox"
            checked={marketingConsent}
            disabled={consentSaving}
            onChange={(e) => handleToggleConsent(e.target.checked)}
          />
          <span>Houd me per e-mail op de hoogte van nieuwe events en acties.</span>
        </label>

        <form className={styles.passwordForm} onSubmit={handleChangePassword}>
          <label htmlFor="visitor-current-password">Huidig wachtwoord</label>
          <input
            id="visitor-current-password"
            type="password"
            placeholder="Alleen nodig om je wachtwoord te wijzigen"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <label htmlFor="visitor-new-password">Nieuw wachtwoord</label>
          <input
            id="visitor-new-password"
            type="password"
            placeholder="Laat leeg om ongewijzigd te laten"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          {passwordError && <p className={styles.error} role="alert">{passwordError}</p>}
          <button type="submit" disabled={passwordSaving || !currentPassword || !newPassword}>
            {passwordSaving ? "Opslaan…" : "Wachtwoord wijzigen"}
          </button>
        </form>
      </div>

      {deleteError && <p className={styles.error} role="alert">{deleteError}</p>}

      <div className={styles.actions}>
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
  );
}

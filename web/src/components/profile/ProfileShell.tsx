"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "radix-ui";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { signOutCurrentUser, deleteCurrentUser, changeAccountPassword } from "@/lib/firebase/auth";
import { subscribeVisitorProfile, deleteAccountCascade, updateMarketingConsent } from "@/lib/firebase/firestore";
import { exportMyData } from "@/lib/firebase/functions";
import { subscribeShops } from "@/lib/firebase/shops";
import { subscribeApprovedBusinessEvents } from "@/lib/firebase/businessEvents";
import { categoryOf, formatBusinessEventSchedule } from "@/lib/events/eventHelpers";
import type { Visitor } from "@/types/account";
import type { Shop } from "@/types/shops";
import type { BusinessEvent } from "@/types/events";
import styles from "./ProfileShell.module.css";

// The schermvullende profielpagina, mirroring how /eventbeheer (BusinessShell)
// replaced its own modal — see PLAN-INLOGGEN.md's history on that page.
// Ported from the old VisitorDashboard modal: same sections, same data,
// just no open/onClose — a mounted page is inherently "open", and
// navigating away (the back link, or the redirect guard below) replaces
// what onClose used to do.
export function ProfileShell() {
  const { currentUser, currentVisitor, currentBusiness, loading, refreshCurrentVisitor } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [liveVisitor, setLiveVisitor] = useState<Visitor | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [businessEvents, setBusinessEvents] = useState<BusinessEvent[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [consentSaving, setConsentSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (!currentVisitor) return;
    const unsubVisitor = subscribeVisitorProfile(currentVisitor.uid, setLiveVisitor);
    const unsubShops = subscribeShops(setShops);
    const unsubEvents = subscribeApprovedBusinessEvents(setBusinessEvents);
    return () => {
      unsubVisitor();
      unsubShops();
      unsubEvents();
    };
  }, [currentVisitor]);

  // A direct link to /profiel while signed out must not render an empty
  // page — send it back to the map instead, same guard shape as
  // BusinessShell's (currentVisitor is the "is anyone signed in at all"
  // check — every signed-in account gets one, per useAuth).
  useEffect(() => {
    if (!loading && !currentVisitor) router.replace("/");
  }, [loading, currentVisitor, router]);

  async function handleLogout() {
    await signOutCurrentUser();
    router.push("/");
  }

  async function handleDeleteAccount() {
    if (!currentUser) return;
    setDeleteError(null);
    try {
      await deleteAccountCascade(currentUser.uid);
      await deleteCurrentUser(currentUser);
      showToast("Account verwijderd.", "success");
      router.push("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Account verwijderen mislukt.");
    }
  }

  async function handleExportData() {
    setExporting(true);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `2happies-gegevens-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Je gegevens zijn gedownload.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Exporteren mislukt.", "error");
    } finally {
      setExporting(false);
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
    <div className={styles.page}>
      <div className={styles.header}>
        <span className={styles.brand}>2happies</span>
        <button type="button" className={styles.backLink} onClick={() => router.push("/")}>
          ← Naar de kaart
        </button>
      </div>

      <div className={styles.content}>
        <p className={styles.email}>{currentVisitor.email}</p>

        {currentBusiness && (
          <div className={styles.section}>
            <button type="button" className={styles.businessLink} onClick={() => router.push("/eventbeheer")}>
              Naar je eventomgeving
            </button>
          </div>
        )}

        <div className={styles.section}>
          <h3>Bewaarde evenementen</h3>
          {savedEvents.length === 0 ? (
            <p className={styles.empty}>Nog geen evenementen bewaard.</p>
          ) : (
            <ul className={styles.list}>
              {savedEvents.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={styles.listItem}
                    onClick={() => router.push(`/event/${e.id}`)}
                  >
                    {categoryOf(e.category).emoji} {e.title} — {formatBusinessEventSchedule(e)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.section}>
          <h3>Geliked</h3>
          {likedShops.length === 0 ? (
            <p className={styles.empty}>Nog geen shops geliked.</p>
          ) : (
            <ul className={styles.list}>
              {likedShops.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={styles.listItem}
                    onClick={() => router.push(`/shop/${s.id}`)}
                  >
                    {s.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.section}>
          <h3>Mijn ratings</h3>
          {ratedShops.length === 0 ? (
            <p className={styles.empty}>Nog geen ratings gegeven.</p>
          ) : (
            <ul className={styles.list}>
              {ratedShops.map(({ shop, rating }) => (
                <li key={shop.id}>
                  <button
                    type="button"
                    className={styles.listItem}
                    onClick={() => router.push(`/shop/${shop.id}`)}
                  >
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
          <button type="button" className={styles.logoutButton} onClick={handleExportData} disabled={exporting}>
            {exporting ? "Bezig…" : "Exporteer mijn gegevens"}
          </button>
          <button type="button" className={styles.logoutButton} onClick={handleLogout}>
            Uitloggen
          </button>
          <AlertDialog.Root>
            <AlertDialog.Trigger asChild>
              <button type="button" className={styles.deleteButton}>
                Account verwijderen
              </button>
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className={styles.confirmBackdrop} />
              <AlertDialog.Content className={styles.confirmDialog}>
                <AlertDialog.Title className={styles.confirmTitle}>Account verwijderen?</AlertDialog.Title>
                <AlertDialog.Description className={styles.confirmDescription}>
                  Dit verwijdert je account en alle bijbehorende gegevens permanent. Dit kan niet ongedaan
                  worden gemaakt.
                </AlertDialog.Description>
                <div className={styles.confirmActions}>
                  <AlertDialog.Cancel asChild>
                    <button type="button" className={styles.logoutButton}>
                      Annuleren
                    </button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action asChild>
                    <button type="button" className={styles.confirmDeleteButton} onClick={handleDeleteAccount}>
                      Ja, verwijderen
                    </button>
                  </AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>
      </div>
    </div>
  );
}

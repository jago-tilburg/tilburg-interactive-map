"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertDialog } from "radix-ui";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { updateBusinessProfile, deleteBusinessProfileCascade } from "@/lib/firebase/firestore";
import { extractCoordsFromMapsUrl } from "@/lib/maps/extractCoordsFromUrl";
import styles from "./BusinessProfileTab.module.css";

// Organisatienaam, standaardadres, en (nieuw) het e-mailadres read-only plus
// "Event-profiel verwijderen" — wachtwoord wijzigen verhuisde naar het
// bezoekersprofiel, want dat hangt aan het account, niet aan deze rol
// (PLAN-INLOGGEN.md §9).
export function BusinessProfileTab() {
  const { currentBusiness, refreshCurrentBusiness } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Repopulates the form from the current profile — during-render sync, same
  // pattern the old dashboard settings tab used, not an effect.
  const [syncedUid, setSyncedUid] = useState<string | null>(null);
  if (currentBusiness && currentBusiness.uid !== syncedUid) {
    setSyncedUid(currentBusiness.uid);
    setName(currentBusiness.businessName);
    setAddress(currentBusiness.defaultAddress ?? "");
    setMapUrl("");
    setLat(currentBusiness.defaultLat ?? null);
    setLng(currentBusiness.defaultLng ?? null);
  }

  if (!currentBusiness) return null;

  function handleExtractCoords() {
    const coords = extractCoordsFromMapsUrl(mapUrl);
    if (!coords) {
      setError("Coördinaten niet gevonden");
      return;
    }
    setError(null);
    setLat(coords.lat);
    setLng(coords.lng);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!currentBusiness) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Organisatienaam mag niet leeg zijn");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateBusinessProfile(currentBusiness.uid, {
        businessName: trimmedName,
        defaultAddress: address.trim(),
        ...(lat !== null && lng !== null ? { defaultLat: lat, defaultLng: lng } : {}),
      });
      await refreshCurrentBusiness();
      showToast("Instellingen opgeslagen", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBusinessProfile() {
    if (!currentBusiness) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteBusinessProfileCascade(currentBusiness.uid);
      await refreshCurrentBusiness();
      showToast("Event-profiel verwijderd.", "success");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
      setDeleting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSave}>
      <label htmlFor="biz-profile-name">Organisatienaam</label>
      <input id="biz-profile-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />

      <label htmlFor="biz-profile-email">E-mail</label>
      <input id="biz-profile-email" type="email" value={currentBusiness.email} disabled />

      <label htmlFor="biz-profile-map-url">Standaardlocatie (voor nieuwe evenementen)</label>
      <div className={styles.row}>
        <input
          id="biz-profile-map-url"
          type="text"
          placeholder="Google Maps URL"
          value={mapUrl}
          onChange={(e) => setMapUrl(e.target.value)}
        />
        <button type="button" onClick={handleExtractCoords}>
          Extract
        </button>
      </div>
      <input
        type="text"
        placeholder="Adres"
        aria-label="Standaardadres"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />

      {error && <p className={styles.error} role="alert">{error}</p>}

      <button type="submit" disabled={saving}>
        {saving ? "Opslaan…" : "Instellingen opslaan"}
      </button>

      <div className={styles.dangerZone}>
        <h3>Event-profiel verwijderen</h3>
        <p>
          Verwijdert je organisatienaam en al je evenementen. Je bezoekersaccount blijft bestaan — je rol opgeven is
          niet hetzelfde als je account opzeggen.
        </p>
        <AlertDialog.Root>
          <AlertDialog.Trigger asChild>
            <button type="button" className={styles.deleteButton} disabled={deleting}>
              {deleting ? "Verwijderen…" : "Event-profiel verwijderen"}
            </button>
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className={styles.confirmBackdrop} />
            <AlertDialog.Content className={styles.confirmDialog}>
              <AlertDialog.Title className={styles.confirmTitle}>Event-profiel verwijderen?</AlertDialog.Title>
              <AlertDialog.Description className={styles.confirmDescription}>
                Dit verwijdert je organisatienaam en al je evenementen permanent, inclusief betaalde/live
                evenementen. Dit kan niet ongedaan worden gemaakt. Je bezoekersaccount blijft bestaan.
              </AlertDialog.Description>
              <div className={styles.confirmActions}>
                <AlertDialog.Cancel asChild>
                  <button type="button" className={styles.cancelButton}>
                    Annuleren
                  </button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <button type="button" className={styles.confirmDeleteButton} onClick={handleDeleteBusinessProfile}>
                    Ja, verwijderen
                  </button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
    </form>
  );
}

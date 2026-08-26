"use client";

import { useState } from "react";
import { PhotoUploadField, type PendingPhoto } from "@/components/common/PhotoUploadField";
import { createBusinessEvent, updateBusinessEvent } from "@/lib/firebase/businessEvents";
import { resolvePhotoUpdate } from "@/lib/photos/resolvePhotoUpdate";
import { useToast } from "@/hooks/useToast";
import {
  EVENT_CATEGORIES,
  dateRangeArray,
  extractCoordsFromMapsUrl,
  isMultiDay,
  activeUmbrellaEvents,
} from "@/lib/events/eventHelpers";
import type { BusinessEvent, DailyTime, EventCategory, EventPriceTier, UmbrellaEvent } from "@/types/events";
import styles from "./BusinessEventForm.module.css";

interface BusinessEventFormProps {
  // Whether this form should currently reflect editingEvent/duplicateFrom —
  // mirrors the old BusinessEventFormModal's `open` prop. Needed because
  // Radix Tabs keeps every Tabs.Content mounted (just hidden), so this form
  // stays mounted while a different /bedrijf tab is showing; without this
  // gate, switching to the "Nieuw event" tab for event A right after
  // finishing event B would still show B's now-stale fields.
  active: boolean;
  ownerId: string;
  editingEvent: BusinessEvent | null;
  duplicateFrom?: BusinessEvent | null;
  umbrellaEvents: UmbrellaEvent[];
  // Called both after a successful save and on "Annuleren" — same single
  // callback the modal wrapper used as `onClose` for both cases.
  onDone: () => void;
}

function emptyForm() {
  return {
    title: "",
    category: "eten" as EventCategory,
    description: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    address: "",
    lat: null as number | null,
    lng: null as number | null,
    mapUrl: "",
    differentTimesPerDay: false,
    dailyTimes: {} as Record<string, DailyTime>,
    umbrellaEventId: "",
    photoUrl: "",
    websiteUrl: "",
    prices: [] as EventPriceTier[],
  };
}

function formFromEvent(ev: BusinessEvent, titleSuffix = "") {
  return {
    title: ev.title + titleSuffix,
    category: ev.category,
    description: ev.description,
    startDate: ev.startDate,
    endDate: ev.endDate,
    startTime: ev.startTime,
    endTime: ev.endTime,
    address: ev.address,
    lat: ev.lat,
    lng: ev.lng,
    mapUrl: "",
    differentTimesPerDay: !!ev.dailyTimes,
    dailyTimes: ev.dailyTimes ?? {},
    umbrellaEventId: ev.umbrellaEventId ?? "",
    photoUrl: ev.photoUrl ?? "",
    websiteUrl: ev.websiteUrl ?? "",
    prices: ev.prices ?? [],
  };
}

export function BusinessEventForm({
  active,
  ownerId,
  editingEvent,
  duplicateFrom,
  umbrellaEvents,
  onDone,
}: BusinessEventFormProps) {
  const { showToast } = useToast();
  // Identifies which record (if any) the form should currently reflect, so a
  // change can be detected and reset during render rather than in an effect
  // (see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const formIdentity = !active ? null : editingEvent ? `edit-${editingEvent.id}` : duplicateFrom ? `dup-${duplicateFrom.id}` : "new";
  const [renderedIdentity, setRenderedIdentity] = useState(formIdentity);
  const [form, setForm] = useState(() =>
    editingEvent ? formFromEvent(editingEvent) : duplicateFrom ? formFromEvent(duplicateFrom, " (kopie)") : emptyForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null);

  if (active && formIdentity !== renderedIdentity) {
    setRenderedIdentity(formIdentity);
    setForm(
      editingEvent
        ? formFromEvent(editingEvent)
        : duplicateFrom
          ? formFromEvent(duplicateFrom, " (kopie)")
          : emptyForm(),
    );
    setError(null);
    setPendingPhoto(null);
  }

  const multiDay = isMultiDay(form.startDate, form.endDate || form.startDate);
  const usePerDay = multiDay && form.differentTimesPerDay;
  const visibleDates = form.startDate ? dateRangeArray(form.startDate, form.endDate || form.startDate) : [];
  const today = new Date().toISOString().slice(0, 10);
  const eligibleUmbrellas = activeUmbrellaEvents(umbrellaEvents, today);

  function updateDateRange(patch: Partial<{ startDate: string; endDate: string }>) {
    setForm((f) => {
      const next = { ...f, ...patch };
      const nowMultiDay = isMultiDay(next.startDate, next.endDate || next.startDate);
      // Mirrors onBeDateRangeChange(): dropping back to a single day resets
      // the per-day-times toggle so the editor doesn't stay open for a
      // range that no longer has more than one day.
      if (!nowMultiDay) next.differentTimesPerDay = false;
      return next;
    });
  }

  function dailyTimeFor(date: string): DailyTime {
    return form.dailyTimes[date] ?? { startTime: form.startTime || "10:00", endTime: form.endTime || "18:00" };
  }

  function setDailyTime(date: string, patch: Partial<DailyTime>) {
    setForm((f) => ({
      ...f,
      dailyTimes: { ...f.dailyTimes, [date]: { ...dailyTimeFor(date), ...patch } },
    }));
  }

  function addPriceRow() {
    setForm((f) => ({ ...f, prices: [...f.prices, { label: "", amount: 0 }] }));
  }

  function updatePriceRow(index: number, patch: Partial<EventPriceTier>) {
    setForm((f) => ({
      ...f,
      prices: f.prices.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  }

  function removePriceRow(index: number) {
    setForm((f) => ({ ...f, prices: f.prices.filter((_, i) => i !== index) }));
  }

  function handleExtractCoords() {
    const coords = extractCoordsFromMapsUrl(form.mapUrl);
    if (!coords) {
      setError("Coördinaten niet gevonden");
      return;
    }
    setError(null);
    setForm((f) => ({ ...f, lat: coords.lat, lng: coords.lng }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const dailyTimesToSave = usePerDay
      ? Object.fromEntries(visibleDates.map((date) => [date, dailyTimeFor(date)]))
      : null;

    let startTime = form.startTime;
    let endTime = form.endTime;
    if (usePerDay && dailyTimesToSave) {
      const sortedDates = Object.keys(dailyTimesToSave).sort();
      startTime = dailyTimesToSave[sortedDates[0]].startTime;
      endTime = dailyTimesToSave[sortedDates[sortedDates.length - 1]].endTime;
    }

    const endDate = form.endDate || form.startDate;

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.startDate ||
      !form.address.trim() ||
      form.lat === null ||
      form.lng === null ||
      !startTime ||
      !endTime
    ) {
      setError("Vul alle verplichte velden in (incl. locatie via Google Maps URL)");
      return;
    }

    const input = {
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      startDate: form.startDate,
      endDate,
      startTime,
      endTime,
      address: form.address.trim(),
      lat: form.lat,
      lng: form.lng,
      multiDay,
      dailyTimes: dailyTimesToSave,
      umbrellaEventId: form.umbrellaEventId || null,
      photoUrl: form.photoUrl.trim(),
      websiteUrl: form.websiteUrl.trim(),
      prices: form.prices.filter((p) => p.label.trim()),
    };

    if (editingEvent) {
      const significantChange =
        editingEvent.title !== input.title ||
        editingEvent.startDate !== input.startDate ||
        editingEvent.endDate !== input.endDate ||
        editingEvent.lat !== input.lat ||
        editingEvent.lng !== input.lng;
      // Firestore rules deny this too (paid events lock these fields), but
      // checking client-side first gives a clear message instead of a raw
      // permission-denied round trip.
      if (significantChange && editingEvent.paid) {
        setError("Titel, datum of locatie van een betaald, live evenement kun je niet meer wijzigen.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (editingEvent) {
        const photoUrl = await resolvePhotoUpdate("businessEvents", editingEvent.id, pendingPhoto, editingEvent.photoUrl ?? "");
        await updateBusinessEvent(editingEvent.id, { ...input, photoUrl });
        showToast("Evenement bijgewerkt.", "success");
        onDone();
      } else {
        const created = await createBusinessEvent(ownerId, input);
        if (pendingPhoto) {
          try {
            const photoUrl = await resolvePhotoUpdate("businessEvents", created.id, pendingPhoto, "");
            if (photoUrl) await updateBusinessEvent(created.id, { ...input, photoUrl });
          } catch {
            showToast("Evenement opgeslagen, maar foto uploaden is mislukt. Voeg de foto later toe via bewerken.", "error");
            onDone();
            return;
          }
        }
        showToast("Evenement toegevoegd. Betaal om het direct live te zetten.", "success");
        onDone();
      }
    } catch (err) {
      setError(err instanceof Error ? `Opslaan mislukt: ${err.message}` : "Opslaan mislukt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Titel"
        aria-label="Titel"
        required
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
      />

      <label htmlFor="be-category">Categorie</label>
      <select
        id="be-category"
        value={form.category}
        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as EventCategory }))}
      >
        {Object.entries(EVENT_CATEGORIES).map(([key, cat]) => (
          <option key={key} value={key}>
            {cat.emoji} {cat.label}
          </option>
        ))}
      </select>

      <textarea
        placeholder="Beschrijving"
        aria-label="Beschrijving"
        required
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
      />

      <div className={styles.row}>
        <div>
          <label htmlFor="be-start-date">Startdatum</label>
          <input
            id="be-start-date"
            type="date"
            required
            value={form.startDate}
            onChange={(e) => updateDateRange({ startDate: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="be-end-date">Einddatum</label>
          <input
            id="be-end-date"
            type="date"
            value={form.endDate}
            onChange={(e) => updateDateRange({ endDate: e.target.value })}
          />
        </div>
      </div>

      {multiDay && (
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={form.differentTimesPerDay}
            onChange={(e) => setForm((f) => ({ ...f, differentTimesPerDay: e.target.checked }))}
          />
          Verschillende tijden per dag
        </label>
      )}

      {usePerDay ? (
        <div className={styles.dailyTimes}>
          {visibleDates.map((date) => {
            const t = dailyTimeFor(date);
            return (
              <div key={date} className={styles.dailyTimeRow}>
                <span>{date}</span>
                <input
                  type="time"
                  aria-label={`Starttijd ${date}`}
                  value={t.startTime}
                  onChange={(e) => setDailyTime(date, { startTime: e.target.value })}
                />
                <input
                  type="time"
                  aria-label={`Eindtijd ${date}`}
                  value={t.endTime}
                  onChange={(e) => setDailyTime(date, { endTime: e.target.value })}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.row}>
          <div>
            <label htmlFor="be-start-time">Starttijd</label>
            <input
              id="be-start-time"
              type="time"
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="be-end-time">Eindtijd</label>
            <input
              id="be-end-time"
              type="time"
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </div>
        </div>
      )}

      {eligibleUmbrellas.length > 0 && (
        <div>
          <label htmlFor="be-umbrella">Onderdeel van groot evenement (optioneel)</label>
          <select
            id="be-umbrella"
            value={form.umbrellaEventId}
            onChange={(e) => setForm((f) => ({ ...f, umbrellaEventId: e.target.value }))}
          >
            <option value="">Geen</option>
            {eligibleUmbrellas.map((u) => (
              <option key={u.id} value={u.id}>
                {u.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <label htmlFor="be-map-url">Google Maps URL</label>
      <div className={styles.row}>
        <input
          id="be-map-url"
          type="text"
          placeholder="https://maps.google.com/..."
          value={form.mapUrl}
          onChange={(e) => setForm((f) => ({ ...f, mapUrl: e.target.value }))}
        />
        <button type="button" onClick={handleExtractCoords}>
          Extract
        </button>
      </div>

      <input
        type="text"
        placeholder="Adres"
        aria-label="Adres"
        required
        value={form.address}
        onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
      />

      <PhotoUploadField
        label="Foto"
        aspectRatio={3 / 4}
        currentUrl={form.photoUrl}
        pendingPhoto={pendingPhoto}
        onPendingPhotoChange={setPendingPhoto}
        disabled={submitting}
      />

      <input
        type="url"
        placeholder="Website-URL (optioneel)"
        aria-label="Website-URL"
        value={form.websiteUrl}
        onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
      />

      <div className={styles.priceRows}>
        <span>Toegangsprijzen (optioneel)</span>
        {form.prices.map((price, index) => (
          <div key={index} className={styles.priceRow}>
            <input
              type="text"
              placeholder="Label (bv. Vroegboekticket)"
              aria-label={`Prijslabel ${index + 1}`}
              value={price.label}
              onChange={(e) => updatePriceRow(index, { label: e.target.value })}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              aria-label={`Prijsbedrag ${index + 1}`}
              value={price.amount}
              onChange={(e) => updatePriceRow(index, { amount: Number(e.target.value) })}
            />
            <label>
              <input
                type="checkbox"
                aria-label={`Gratis ${index + 1}`}
                checked={price.amount === 0}
                onChange={(e) => updatePriceRow(index, { amount: e.target.checked ? 0 : price.amount })}
              />
              Gratis
            </label>
            <button type="button" onClick={() => removePriceRow(index)}>
              Verwijderen
            </button>
          </div>
        ))}
        <button type="button" onClick={addPriceRow}>
          + Voeg toegangsprijs toe
        </button>
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        <button type="submit" disabled={submitting}>
          Opslaan
        </button>
        <button type="button" onClick={onDone}>
          Annuleren
        </button>
      </div>
    </form>
  );
}

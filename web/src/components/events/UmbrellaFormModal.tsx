"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { createUmbrellaEvent, updateUmbrellaEvent } from "@/lib/firebase/umbrellaEvents";
import type { UmbrellaEvent } from "@/types/events";
import styles from "./UmbrellaFormModal.module.css";

interface UmbrellaFormModalProps {
  open: boolean;
  onClose: () => void;
  editingUmbrella: UmbrellaEvent | null;
}

function emptyForm() {
  return {
    title: "",
    description: "",
    color: "#b45309",
    photoUrl: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  };
}

export function UmbrellaFormModal({ open, onClose, editingUmbrella }: UmbrellaFormModalProps) {
  const formIdentity = !open ? null : (editingUmbrella?.id ?? "new");
  const [renderedIdentity, setRenderedIdentity] = useState(formIdentity);
  const [form, setForm] = useState(() =>
    editingUmbrella
      ? {
          title: editingUmbrella.title,
          description: editingUmbrella.description,
          color: editingUmbrella.color || "#b45309",
          photoUrl: editingUmbrella.photoUrl ?? "",
          startDate: editingUmbrella.startDate,
          endDate: editingUmbrella.endDate,
        }
      : emptyForm(),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (open && formIdentity !== renderedIdentity) {
    setRenderedIdentity(formIdentity);
    setForm(
      editingUmbrella
        ? {
            title: editingUmbrella.title,
            description: editingUmbrella.description,
            color: editingUmbrella.color || "#b45309",
            photoUrl: editingUmbrella.photoUrl ?? "",
            startDate: editingUmbrella.startDate,
            endDate: editingUmbrella.endDate,
          }
        : emptyForm(),
    );
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim() || !form.startDate || !form.endDate) {
      setError("Vul naam, startdatum en einddatum in");
      return;
    }
    const input = {
      title: form.title.trim(),
      description: form.description.trim(),
      color: form.color,
      photoUrl: form.photoUrl.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
    };
    setSubmitting(true);
    try {
      if (editingUmbrella) {
        await updateUmbrellaEvent(editingUmbrella.id, input);
      } else {
        await createUmbrellaEvent(input);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? `Opslaan mislukt: ${err.message}` : "Opslaan mislukt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingUmbrella ? "Groot Tilburgs event bewerken" : "Groot Tilburgs event toevoegen"}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Naam (bv. Tilburgse Kermis 2026)"
          aria-label="Naam"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
        <div className={styles.row}>
          <input
            type="date"
            aria-label="Startdatum"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          />
          <input
            type="date"
            aria-label="Einddatum"
            value={form.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          />
        </div>
        <textarea
          placeholder="Omschrijving..."
          aria-label="Omschrijving"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <input
          type="url"
          placeholder="Foto-URL (bv. https://...)"
          aria-label="Foto-URL"
          value={form.photoUrl}
          onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
        />
        <label htmlFor="umbrella-color">Kleur</label>
        <input
          id="umbrella-color"
          type="color"
          value={form.color}
          onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
        />
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="submit" disabled={submitting}>
            Opslaan
          </button>
          <button type="button" onClick={onClose}>
            Annuleren
          </button>
        </div>
      </form>
    </Modal>
  );
}

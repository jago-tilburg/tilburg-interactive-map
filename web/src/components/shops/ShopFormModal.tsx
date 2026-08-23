"use client";

import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { createShop, updateShop } from "@/lib/firebase/shops";
import { extractCoordsFromMapsUrl } from "@/lib/maps/extractCoordsFromUrl";
import { RATING_SELECT_OPTIONS } from "@/lib/shops/shopHelpers";
import type { Shop, ShopInput } from "@/types/shops";
import styles from "./ShopFormModal.module.css";

interface ShopFormModalProps {
  open: boolean;
  onClose: () => void;
  editingShop: Shop | null;
}

function emptyForm() {
  return {
    name: "",
    address: "",
    mapUrl: "",
    lat: "51.5555",
    lng: "5.0913",
    rating: "8.0",
    price: "€€",
    photoUrl: "",
    review: "",
    tiktokUrl: "",
    instagramUrl: "",
    glutenvrij: false,
    halal: false,
    vega: false,
  };
}

function formFromShop(shop: Shop) {
  return {
    name: shop.name,
    address: shop.address,
    mapUrl: "",
    lat: String(shop.lat),
    lng: String(shop.lng),
    rating: shop.rating.toFixed(1),
    price: shop.price,
    photoUrl: shop.photoUrl,
    review: shop.review,
    tiktokUrl: shop.tiktokUrl,
    instagramUrl: shop.instagramUrl,
    glutenvrij: shop.dietaryOptions.glutenvrij,
    halal: shop.dietaryOptions.halal,
    vega: shop.dietaryOptions.vega,
  };
}

export function ShopFormModal({ open, onClose, editingShop }: ShopFormModalProps) {
  const formIdentity = !open ? null : (editingShop?.id ?? "new");
  const [renderedIdentity, setRenderedIdentity] = useState(formIdentity);
  const [form, setForm] = useState(() => (editingShop ? formFromShop(editingShop) : emptyForm()));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (open && formIdentity !== renderedIdentity) {
    setRenderedIdentity(formIdentity);
    setForm(editingShop ? formFromShop(editingShop) : emptyForm());
    setError(null);
  }

  function handleExtractCoords() {
    const coords = extractCoordsFromMapsUrl(form.mapUrl);
    if (!coords) {
      setError("Coördinaten niet gevonden");
      return;
    }
    setError(null);
    setForm((f) => ({ ...f, lat: String(coords.lat), lng: String(coords.lng) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    const address = form.address.trim();
    const review = form.review.trim();
    if (!name || !address || !review) {
      setError("Vul alle verplichte velden in");
      return;
    }

    const input: ShopInput = {
      name,
      address,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      rating: parseFloat(form.rating),
      price: form.price,
      photoUrl: form.photoUrl.trim(),
      review,
      tiktokUrl: form.tiktokUrl.trim(),
      instagramUrl: form.instagramUrl.trim(),
      dietaryOptions: { glutenvrij: form.glutenvrij, halal: form.halal, vega: form.vega },
    };

    setSubmitting(true);
    try {
      if (editingShop) {
        await updateShop(editingShop.id, input);
      } else {
        await createShop(input);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? `Opslaan mislukt: ${err.message}` : "Opslaan mislukt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editingShop ? "Bewerken Review" : "Add New Review"}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Naam Zaak"
          aria-label="Naam Zaak"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          type="text"
          placeholder="Adres"
          aria-label="Adres"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />

        <label htmlFor="shop-map-url">Google Maps URL</label>
        <div className={styles.row}>
          <input
            id="shop-map-url"
            type="text"
            placeholder="https://maps.google.com/..."
            value={form.mapUrl}
            onChange={(e) => setForm((f) => ({ ...f, mapUrl: e.target.value }))}
          />
          <button type="button" onClick={handleExtractCoords}>
            Extract
          </button>
        </div>

        <div className={styles.row}>
          <input
            type="number"
            step="0.0001"
            aria-label="Breedtegraad"
            value={form.lat}
            onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
          />
          <input
            type="number"
            step="0.0001"
            aria-label="Lengtegraad"
            value={form.lng}
            onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
          />
        </div>

        <div className={styles.row}>
          <select aria-label="Beoordeling" value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}>
            {RATING_SELECT_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r} ⭐
              </option>
            ))}
          </select>
          <select aria-label="Prijs" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}>
            <option value="€">€</option>
            <option value="€€">€€</option>
            <option value="€€€">€€€</option>
          </select>
        </div>

        <div className={styles.row}>
          <input
            type="text"
            placeholder="🎵 TikTok URL (optional)"
            aria-label="TikTok URL"
            value={form.tiktokUrl}
            onChange={(e) => setForm((f) => ({ ...f, tiktokUrl: e.target.value }))}
          />
          <input
            type="text"
            placeholder="📸 Instagram URL (optional)"
            aria-label="Instagram URL"
            value={form.instagramUrl}
            onChange={(e) => setForm((f) => ({ ...f, instagramUrl: e.target.value }))}
          />
        </div>

        <input
          type="text"
          placeholder="Foto URL (optional)"
          aria-label="Foto URL"
          value={form.photoUrl}
          onChange={(e) => setForm((f) => ({ ...f, photoUrl: e.target.value }))}
        />

        <div className={styles.dietaryRow}>
          <label>
            <input
              type="checkbox"
              checked={form.glutenvrij}
              onChange={(e) => setForm((f) => ({ ...f, glutenvrij: e.target.checked }))}
            />
            🌾 Glutenvrij
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.halal}
              onChange={(e) => setForm((f) => ({ ...f, halal: e.target.checked }))}
            />
            ☪️ Halal
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.vega}
              onChange={(e) => setForm((f) => ({ ...f, vega: e.target.checked }))}
            />
            🌿 Vega
          </label>
        </div>

        <textarea
          placeholder="Je review..."
          aria-label="Je review"
          rows={6}
          value={form.review}
          onChange={(e) => setForm((f) => ({ ...f, review: e.target.value }))}
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

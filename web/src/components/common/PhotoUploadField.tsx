"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { isHeic, convertHeicToJpeg } from "@/lib/photos/heicConvert";
import { validatePhotoFile, loadImageDimensions, isLargeEnough } from "@/lib/photos/imageFile";
import { cropToWebp } from "@/lib/photos/cropToWebp";
import styles from "./PhotoUploadField.module.css";

const MAX_DIMENSION = 1600;
const QUALITY = 0.8;

export type PendingPhoto = { action: "replace"; blob: Blob; previewUrl: string } | { action: "remove" };

interface PhotoUploadFieldProps {
  label: string;
  aspectRatio: number;
  currentUrl: string;
  pendingPhoto: PendingPhoto | null;
  onPendingPhotoChange: (photo: PendingPhoto | null) => void;
  disabled?: boolean;
}

// Shared upload UI for shops/businessEvents/umbrellaEvents (single photo
// per record, replace/remove only — no gallery, per GO-LIVE-CHECKLIST.md
// §5). Does NOT upload to Storage itself — it only produces a ready-to-
// upload WebP Blob (cropped/compressed client-side) and lifts it to the
// parent form as controlled state. The actual Storage upload happens at
// submit time in the parent, after the record's id is known (see the
// upload-timing note in the photo-upload plan: storage.rules' businessEvents
// write check needs the Firestore doc to already exist).
export function PhotoUploadField({
  label,
  aspectRatio,
  currentUrl,
  pendingPhoto,
  onPendingPhotoChange,
  disabled = false,
}: PhotoUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  async function handleFileSelected(file: File) {
    setError(null);
    const validationError = validatePhotoFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      const decodable = isHeic(file) ? await convertHeicToJpeg(file) : file;
      const objectUrl = URL.createObjectURL(decodable);
      const dimensions = await loadImageDimensions(objectUrl);
      if (!isLargeEnough(dimensions)) {
        URL.revokeObjectURL(objectUrl);
        setError("Foto is te klein (minimaal 480×480 pixels).");
        return;
      }
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCropSource(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Foto verwerken is mislukt.");
    } finally {
      setBusy(false);
    }
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void handleFileSelected(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled || busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFileSelected(file);
  }

  function handleCropCancel() {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  }

  async function handleCropConfirm() {
    if (!cropSource || !croppedAreaPixels) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await cropToWebp(cropSource, croppedAreaPixels, MAX_DIMENSION, QUALITY);
      const previewUrl = URL.createObjectURL(blob);
      if (pendingPhoto?.action === "replace") URL.revokeObjectURL(pendingPhoto.previewUrl);
      onPendingPhotoChange({ action: "replace", blob, previewUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Foto comprimeren is mislukt.");
    } finally {
      URL.revokeObjectURL(cropSource);
      setCropSource(null);
      setBusy(false);
    }
  }

  function handleRemove() {
    if (pendingPhoto?.action === "replace") URL.revokeObjectURL(pendingPhoto.previewUrl);
    onPendingPhotoChange({ action: "remove" });
  }

  function handleUndoRemove() {
    onPendingPhotoChange(null);
  }

  const displayUrl =
    pendingPhoto?.action === "replace" ? pendingPhoto.previewUrl : pendingPhoto?.action === "remove" ? null : currentUrl || null;

  if (cropSource) {
    return (
      <div className={styles.field}>
        <span className={styles.label}>{label}</span>
        <div className={styles.cropStage} style={{ aspectRatio }}>
          <Cropper
            image={cropSource}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_area, areaPixels) => setCroppedAreaPixels(areaPixels)}
          />
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.cropActions}>
          <button type="button" onClick={handleCropConfirm} disabled={busy || !croppedAreaPixels}>
            Bijsnijden bevestigen
          </button>
          <button type="button" onClick={handleCropCancel} disabled={busy}>
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div
        className={displayUrl ? styles.preview : styles.placeholder}
        style={{ aspectRatio }}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {displayUrl ? <img src={displayUrl} alt={label} className={styles.previewImage} /> : "Sleep een foto hierheen of kies er een"}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        aria-label={label}
        onChange={handleInputChange}
        className={styles.hiddenInput}
      />
      <div className={styles.pickerActions}>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={disabled || busy}>
          {displayUrl ? "Andere foto kiezen" : "Foto kiezen"}
        </button>
        {displayUrl && (
          <button type="button" onClick={handleRemove} disabled={disabled || busy}>
            Verwijderen
          </button>
        )}
        {pendingPhoto?.action === "remove" && (
          <button type="button" onClick={handleUndoRemove} disabled={disabled || busy}>
            Ongedaan maken
          </button>
        )}
      </div>
      {busy && <p className={styles.status}>Foto verwerken…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}

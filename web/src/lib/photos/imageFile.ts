import { isHeic } from "./heicConvert";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_RAW_BYTES = 10 * 1024 * 1024;
export const MIN_DIMENSION = 480;

// Rejected client-side before any upload starts, per the locked plan in
// GO-LIVE-CHECKLIST.md §5 — raw size cap and accepted formats (HEIC/HEIF
// included, converted separately by heicConvert.ts).
export function validatePhotoFile(file: File): string | null {
  if (file.size > MAX_RAW_BYTES) {
    return "Foto is te groot (max 10MB).";
  }
  if (!ACCEPTED_TYPES.includes(file.type.toLowerCase()) && !isHeic(file)) {
    return "Ongeldig bestandstype. Gebruik JPEG, PNG, WebP of HEIC.";
  }
  return null;
}

export function loadImageDimensions(objectUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Afbeelding kon niet worden gelezen."));
    img.src = objectUrl;
  });
}

// Rejects anything that would look pixelated once cropped/scaled — checked
// against the source image's natural dimensions, before cropping only
// shrinks it further.
export function isLargeEnough(dimensions: { width: number; height: number }): boolean {
  return dimensions.width >= MIN_DIMENSION && dimensions.height >= MIN_DIMENSION;
}

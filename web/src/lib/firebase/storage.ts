import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type FirebaseStorage,
} from "firebase/storage";
import { getFirebaseApp } from "./app";

export type PhotoKind = "shops" | "businessEvents" | "umbrellaEvents";

export function getPhotoStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}

function uploadOnce(path: string, blob: Blob, onProgress?: (pct: number) => void): Promise<string> {
  const fileRef = ref(getPhotoStorage(), path);
  const task = uploadBytesResumable(fileRef, blob, { contentType: "image/webp" });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => onProgress?.((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      reject,
      () => getDownloadURL(task.snapshot.ref).then(resolve, reject),
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Delays between retries of a storage/unauthorized — see uploadPhoto below.
export const UNAUTHORIZED_RETRY_DELAYS_MS = [400, 800, 1600];

// Path shape locked in GO-LIVE-CHECKLIST.md §5: {kind}/{id}/{uuid}.webp —
// never the original filename (avoids leaking device/PII metadata via the
// path itself), fresh generated id per upload. Matches storage.rules'
// admin-or-owner write gate for each kind.
export async function uploadPhoto(
  kind: PhotoKind,
  id: string | number,
  blob: Blob,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const path = `${kind}/${id}/${crypto.randomUUID()}.webp`;

  // Every caller of this function creates the parent doc (businessEvents/
  // shops/umbrellaEvents) and uploads its photo right after — but a
  // freshly written Firestore doc isn't always immediately visible to
  // Storage Rules' cross-service firestore.get() read, so that first
  // upload attempt can race ahead of it and come back storage/unauthorized
  // even though the doc (and its ownerId) is genuinely correct. Confirmed
  // live 2026-09-03: a brand-new event, photo uploaded immediately after
  // creation, failed this way reliably on the first attempt for a real
  // account. A short retry is the pragmatic fix for this specific error
  // code — any other cause of storage/unauthorized (e.g. a real ownership
  // mismatch) still fails once the retries are exhausted, just slower.
  for (let attempt = 0; ; attempt++) {
    try {
      return await uploadOnce(path, blob, onProgress);
    } catch (err) {
      const isLastAttempt = attempt >= UNAUTHORIZED_RETRY_DELAYS_MS.length;
      if ((err as { code?: string })?.code !== "storage/unauthorized" || isLastAttempt) throw err;
      await sleep(UNAUTHORIZED_RETRY_DELAYS_MS[attempt]);
    }
  }
}

// Best-effort cleanup when replacing/removing a photo. Never touches a URL
// that isn't one of our own Storage objects — most existing shops/events
// still have a business-supplied external photoUrl, which this must never
// try to delete. ref() throws synchronously for a URL it doesn't recognize
// as its own gs://.../https download-URL shape, which is exactly the
// signal used here.
export async function deleteOwnPhoto(url: string): Promise<void> {
  if (!url) return;

  let fileRef;
  try {
    fileRef = ref(getPhotoStorage(), url);
  } catch {
    return;
  }

  try {
    await deleteObject(fileRef);
  } catch (err) {
    if ((err as { code?: string }).code !== "storage/object-not-found") throw err;
  }
}

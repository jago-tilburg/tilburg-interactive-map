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

// Path shape locked in GO-LIVE-CHECKLIST.md §5: {kind}/{id}/{uuid}.webp —
// never the original filename (avoids leaking device/PII metadata via the
// path itself), fresh generated id per upload. Matches storage.rules'
// admin-or-owner write gate for each kind.
export function uploadPhoto(
  kind: PhotoKind,
  id: string | number,
  blob: Blob,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const path = `${kind}/${id}/${crypto.randomUUID()}.webp`;
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

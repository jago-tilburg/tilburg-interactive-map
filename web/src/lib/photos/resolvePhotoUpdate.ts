import { uploadPhoto, deleteOwnPhoto, type PhotoKind } from "@/lib/firebase/storage";
import { trackEvent } from "@/lib/analytics/trackEvent";
import type { PendingPhoto } from "@/components/common/PhotoUploadField";

// Resolves the final photoUrl for a create/update save from a
// PhotoUploadField's pending action, and best-effort deletes the Storage
// object it's replacing/removing (deleteOwnPhoto no-ops on a business-
// supplied external URL — never touches those). Shared by
// ShopFormModal/BusinessEventFormModal/UmbrellaFormModal, which otherwise
// only differ in which create/update function and PhotoKind they use.
export async function resolvePhotoUpdate(
  kind: PhotoKind,
  id: string | number,
  pendingPhoto: PendingPhoto | null,
  previousUrl: string,
): Promise<string> {
  if (!pendingPhoto) return previousUrl;

  if (pendingPhoto.action === "remove") {
    await deleteOwnPhoto(previousUrl).catch(() => {});
    return "";
  }

  trackEvent("photo_upload_started", { kind });
  let newUrl: string;
  try {
    newUrl = await uploadPhoto(kind, id, pendingPhoto.blob);
  } catch (err) {
    trackEvent("photo_upload_failed", { kind });
    throw err;
  }
  trackEvent("photo_upload_success", { kind });
  await deleteOwnPhoto(previousUrl).catch(() => {});
  return newUrl;
}

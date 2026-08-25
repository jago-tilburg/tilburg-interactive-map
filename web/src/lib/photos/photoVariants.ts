// Deliberately a plain string check, not web/src/lib/firebase/storage.ts's
// ref()-throws approach — markerIcons.ts (this module's main consumer) is a
// pure, Firebase-SDK-free rendering utility and should stay that way. The
// worst case of this looser heuristic is a wrong-but-harmless <img> load
// attempt, not a wrong delete (unlike deleteOwnPhoto, which needs the
// stricter check).
const OWN_STORAGE_PREFIX = "https://firebasestorage.googleapis.com/v0/b/";

export function isOwnStoragePhotoUrl(url: string): boolean {
  return url.startsWith(OWN_STORAGE_PREFIX);
}

// processPhotoUpload (functions/index.js) generates {base}_thumb.webp and
// {base}_detail.webp alongside every original it processes. Returns the
// url unchanged for anything that isn't one of our own Storage objects —
// a business-supplied external photoUrl never had a derivative generated
// for it. encodeURIComponent never escapes '.', so a real Firebase
// download URL's encoded object path still has a literal ".webp" right
// before the "?alt=media" query string (or at the end, with no query).
export function photoVariantUrl(url: string, variant: "thumb" | "detail"): string {
  if (!url || !isOwnStoragePhotoUrl(url)) return url;
  return url.replace(/\.webp(?=(\?|$))/, `_${variant}.webp`);
}

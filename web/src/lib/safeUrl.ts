// Shop/event `websiteUrl`/`tiktokUrl`/`instagramUrl` are free-text fields —
// any authenticated business can set them on their own record (see
// firestore.rules/database.rules.json; there's no scheme restriction at
// write time), and they're rendered straight into `<a href>` / window.open()
// without going through React's text-escaping the way plain content does.
// A `javascript:`/`data:`/`vbscript:` URI would execute in the visitor's
// browser when clicked. Found via a pen-test — this is the guard at the
// actual point of use, since validating every write path (Firestore rules
// have limited regex support; RTDB rules have none) is far more fragile
// than checking the scheme right before it's ever used for navigation.
export function isSafeHttpUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

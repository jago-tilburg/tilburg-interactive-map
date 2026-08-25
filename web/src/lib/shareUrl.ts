// Shares the current page URL — native share sheet where available (the
// common case on mobile, which is what actually matters for this feature),
// clipboard copy otherwise. Resolves true only when something was actually
// shared/copied, so callers can distinguish "the user cancelled the native
// share sheet" from "it worked" (navigator.share() rejects with an
// AbortError on cancel).
export async function shareCurrentUrl(title: string): Promise<boolean> {
  const url = window.location.href;

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ url, title });
      return true;
    } catch {
      return false;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

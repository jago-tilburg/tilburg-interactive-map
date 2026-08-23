import { trackEvent } from "@/lib/analytics/trackEvent";

// Pure URL-building logic, given a user agent string, so platform branching
// is testable without mocking navigator.
export function buildNavigationUrl(lat: number, lng: number, name: string, userAgent: string): string {
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);

  if (isIOS) {
    return `maps://maps.google.com/maps?daddr=${lat},${lng}`;
  }
  if (isAndroid) {
    return `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// iOS's maps:// scheme silently fails to open in some browser contexts with
// no fallback — the monolith covers that with a delayed https:// retry.
export function navigateToLocation(lat: number, lng: number, name: string): void {
  trackEvent("navigate_to_shop", { shop_name: name, latitude: lat, longitude: lng });

  const userAgent = window.navigator.userAgent;
  const url = buildNavigationUrl(lat, lng, name, userAgent);
  window.open(url, "_blank");

  if (/iPad|iPhone|iPod/.test(userAgent)) {
    window.setTimeout(() => {
      window.location.assign(`https://maps.google.com/maps?daddr=${lat},${lng}`);
    }, 500);
  }
}

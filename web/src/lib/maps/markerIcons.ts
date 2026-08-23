import { ratingColor } from "@/lib/shops/shopHelpers";

// Same drop-pin SVG (data URI) the monolith's makeDropIcon() builds — color-
// coded by rating, with the rating printed inside when showText is true.
// Returns a plain data URI + size/anchor rather than google.maps.Size/Point
// objects so this stays a pure, Maps-API-independent function; the caller
// wraps the numbers in google.maps.* types when it actually builds a marker.
export function buildDropIconDataUrl(rating: number, color: string, showText = true): string {
  const text = showText ? (rating || 0).toFixed(1) : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 28" width="40" height="47">
    <path d="M12 1C7.58 1 4 4.58 4 9c0 6.75 8 18 8 18s8-11.25 8-18c0-4.42-3.58-8-8-8z"
          fill="${color}" stroke="white" stroke-width="1.5"/>
    ${text ? `<text x="12" y="10" font-family="sans-serif" font-size="7" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="middle">${text}</text>` : ""}
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

export const DROP_ICON_SIZE = { width: 40, height: 47 };
export const DROP_ICON_ANCHOR = { x: 20, y: 47 };

export function buildShopIconDataUrl(rating: number, showText = true): string {
  return buildDropIconDataUrl(rating, ratingColor(rating), showText);
}

// Fixed star path used for both event marker types in the monolith
// (createEventMarker / createBusinessEventMarker) — only the fill color
// differs (legacy RTDB events: purple; business events: pink).
export const EVENT_STAR_PATH =
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
export const LEGACY_EVENT_COLOR = "#9333ea";
export const BUSINESS_EVENT_COLOR = "#ec4899";
export const EVENT_ICON_ANCHOR = { x: 12, y: 12 };

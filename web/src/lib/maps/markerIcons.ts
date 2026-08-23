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

// Zoom-scaled "photo card" event marker — a simplified, non-animated port of
// the prototype's buildEventCardIcon()/computeMarkerSize(): a rounded card
// with a bottom pointer, a clipped photo (or a category-emoji placeholder),
// and a two-stop gradient border. Deliberately dropped from the prototype:
// the rotating-gradient-border animation and the "happening now" pulsing
// glow (both pure CSS/SVG polish, not core to the marker's information) —
// noted here rather than silently ported as static-only.
const CARD_BASE_ZOOM = 14;
const CARD_BASE_WIDTH = 49;
const CARD_ASPECT = 4 / 3; // width:height, matches the prototype's 3:4 photo panel below a header strip
const CARD_SCALE_PER_ZOOM = 1.4;
const CARD_MIN_WIDTH = 28;
const CARD_MAX_WIDTH = 200;

export function computeEventCardWidth(zoom: number): number {
  const width = CARD_BASE_WIDTH * Math.pow(CARD_SCALE_PER_ZOOM, zoom - CARD_BASE_ZOOM);
  return Math.min(CARD_MAX_WIDTH, Math.max(CARD_MIN_WIDTH, Math.round(width)));
}

export interface EventCardIconOptions {
  width: number;
  photoUrl?: string;
  categoryEmoji: string;
  borderColors: [string, string];
}

// Rounded-rect card body with a small triangular pointer at the bottom
// center, used both as the visible outline and as the photo clip region.
function cardOutlinePath(width: number, height: number, radius: number, pointerSize: number): string {
  const w = width;
  const h = height - pointerSize;
  const r = Math.min(radius, w / 2, h / 2);
  const cx = w / 2;
  return [
    `M${r},0`,
    `H${w - r}`,
    `Q${w},0 ${w},${r}`,
    `V${h - r}`,
    `Q${w},${h} ${w - r},${h}`,
    `H${cx + pointerSize / 2}`,
    `L${cx},${h + pointerSize}`,
    `L${cx - pointerSize / 2},${h}`,
    `H${r}`,
    `Q0,${h} 0,${h - r}`,
    `V${r}`,
    `Q0,0 ${r},0`,
    "Z",
  ].join(" ");
}

export function buildEventCardIconDataUrl(options: EventCardIconOptions): { url: string; height: number } {
  const { width, photoUrl, categoryEmoji, borderColors } = options;
  const height = Math.round(width * CARD_ASPECT);
  const pointerSize = Math.max(6, Math.round(width * 0.18));
  const border = Math.max(2, Math.round(width * 0.06));
  const radius = Math.round(width * 0.22);
  const outline = cardOutlinePath(width, height, radius, pointerSize);
  const gradientId = "cardBorder";
  const clipId = "cardPhoto";

  const photo = photoUrl
    ? `<image href="${photoUrl}" x="0" y="0" width="${width}" height="${height - pointerSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" />`
    : `<rect x="0" y="0" width="${width}" height="${height - pointerSize}" rx="${radius}" fill="#f0ebe4" />
       <text x="${width / 2}" y="${(height - pointerSize) / 2}" font-size="${Math.round(width * 0.4)}" text-anchor="middle" dominant-baseline="central">${categoryEmoji}</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${borderColors[0]}" />
        <stop offset="100%" stop-color="${borderColors[1]}" />
      </linearGradient>
      <clipPath id="${clipId}"><path d="${outline}" /></clipPath>
    </defs>
    ${photo}
    <path d="${outline}" fill="none" stroke="url(#${gradientId})" stroke-width="${border}" stroke-linejoin="round" />
  </svg>`;

  return { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg), height };
}

// Lightens/darkens a hex color by `percent` (-100..100) — used to derive the
// second gradient stop from an umbrella event's single brand color, matching
// the prototype's shadeColor().
export function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0x00ff) + amt);
  const b = clamp((num & 0x0000ff) + amt);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export const DEFAULT_CARD_BORDER: [string, string] = ["#22c55e", "#ff6b35"];

import { ratingColor } from "@/lib/shops/shopHelpers";
import { photoVariantUrl } from "@/lib/photos/photoVariants";

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

// Literal port of the prototype's marker-tuning-panel defaults
// (MARKER_TUNING_DEFAULTS) plus buildOutlinePath/buildPhotoClipPath/
// buildEventCardIcon/computeMarkerSize/computeIconScaledSize. The prototype
// lets an operator live-tune these via a dev-only panel (saved to
// localStorage, per-device) — these are what a visitor with no saved
// tuning actually sees, which is what staging needs to match. Earlier
// version of this file re-derived the shape as rough percentages of width;
// that was the wrong strategy — the prototype's shape/gradient/glow math
// only matches when ported literally, not approximated.
const MARKER_TUNING = {
  baseZoom: 14,
  baseWidth: 49,
  scalePerZoom: 1.4,
  minWidth: 28,
  maxWidth: 200,
  aspectRatio: 1.5,
  cornerRadius: 10,
  shoulderRadius: 4.75,
  tipRadius: 5,
  pointerWidth: 7,
  pointerHeight: 18,
  photoWidth: 42,
  photoHeight: 62,
  gradientLighten: 0,
  gradientDarken: 0,
  gradientMidpoint: 48,
  gradientSpread: 13,
  gradientRotationDuration: 2.5,
  glowBlur: 12,
  glowPad: 27,
  glowColorShade: 4,
  glowOpacityMin: 0,
  glowOpacityMax: 1,
  glowDuration: 1.5,
} as const;

// The "logical" on-screen card size for a given zoom — decoupled from the
// icon's own fixed 60-wide internal SVG coordinate space (see
// buildEventCardIconDataUrl); computeIconScaledSize reconciles the two.
export function computeMarkerSize(zoom: number): { w: number; h: number } {
  const factor = Math.pow(MARKER_TUNING.scalePerZoom, zoom - MARKER_TUNING.baseZoom);
  let w = MARKER_TUNING.baseWidth * factor;
  w = Math.min(MARKER_TUNING.maxWidth, Math.max(MARKER_TUNING.minWidth, w));
  return { w: Math.round(w), h: Math.round(w * MARKER_TUNING.aspectRatio) };
}

// Card body + bottom pointer outline, in the fixed 60-wide coordinate space.
// R = corner radius, rs = shoulder radius (where the body meets the
// pointer), rt = tip radius (rounds the pointer's own tip).
function buildOutlinePath(R: number, rs: number, rt: number, pointerWidth: number, pointerHeight: number): string {
  const marginX = 8,
    marginTop = 2,
    bodyBottom = 66,
    centerX = 30;
  const tipX = centerX,
    tipY = bodyBottom + pointerHeight;
  const shoulderR = centerX + pointerWidth / 2;
  const shoulderL = centerX - pointerWidth / 2;
  // Never zero: pointerWidth/pointerHeight are fixed non-zero constants
  // above (this guarded against a zero-length vector in the prototype's
  // dynamic tuning panel, which isn't ported here).
  const dx1 = tipX - shoulderR,
    dy1 = tipY - bodyBottom;
  const len1 = Math.hypot(dx1, dy1);
  const u1 = { x: dx1 / len1, y: dy1 / len1 };
  const dx2 = shoulderL - tipX,
    dy2 = bodyBottom - tipY;
  const len2 = Math.hypot(dx2, dy2);
  const u2 = { x: dx2 / len2, y: dy2 / len2 };
  const fmt = (n: number) => Math.round(n * 100) / 100;

  const rightIn = { x: shoulderR + rs, y: bodyBottom };
  const rightOut = { x: shoulderR + u1.x * rs, y: bodyBottom + u1.y * rs };
  const tipIn = { x: tipX - u1.x * rt, y: tipY - u1.y * rt };
  const tipOut = { x: tipX + u2.x * rt, y: tipY + u2.y * rt };
  const leftIn = { x: shoulderL - u2.x * rs, y: bodyBottom - u2.y * rs };
  const leftOut = { x: shoulderL - rs, y: bodyBottom };

  return `M${marginX + R},${marginTop} H${60 - marginX - R} A${R},${R} 0 0 1 ${60 - marginX},${marginTop + R} V${bodyBottom - R} A${R},${R} 0 0 1 ${60 - marginX - R},${bodyBottom} H${fmt(rightIn.x)} Q${fmt(shoulderR)},${bodyBottom} ${fmt(rightOut.x)},${fmt(rightOut.y)} L${fmt(tipIn.x)},${fmt(tipIn.y)} Q${fmt(tipX)},${fmt(tipY)} ${fmt(tipOut.x)},${fmt(tipOut.y)} L${fmt(leftIn.x)},${fmt(leftIn.y)} Q${fmt(shoulderL)},${bodyBottom} ${fmt(leftOut.x)},${bodyBottom} H${marginX + R} A${R},${R} 0 0 1 ${marginX},${bodyBottom - R} V${marginTop + R} A${R},${R} 0 0 1 ${marginX + R},${marginTop} Z`;
}

// The photo clip region — a rounded rect centered within the card body,
// inset from the outline by whatever margin photoWidth/photoHeight leave
// (that inset is what reads visually as the gradient "border").
function buildPhotoClipPath(cornerRadius: number, photoWidth: number, photoHeight: number): string {
  const cardLeft = 8,
    cardRight = 52,
    cardTop = 2,
    cardBottom = 66;
  const marginX = cardLeft + ((cardRight - cardLeft) - photoWidth) / 2;
  const marginTop = cardTop + ((cardBottom - cardTop) - photoHeight) / 2;
  const right = marginX + photoWidth,
    bottom = marginTop + photoHeight;
  const borderWidth = Math.min(marginX - cardLeft, marginTop - cardTop);
  const r = Math.max(0, Math.min(cornerRadius - borderWidth, Math.min(photoWidth, photoHeight) / 2));
  return `M${marginX + r},${marginTop} H${right - r} A${r},${r} 0 0 1 ${right},${marginTop + r} V${bottom - r} A${r},${r} 0 0 1 ${right - r},${bottom} H${marginX + r} A${r},${r} 0 0 1 ${marginX},${bottom - r} V${marginTop + r} A${r},${r} 0 0 1 ${marginX + r},${marginTop} Z`;
}

export interface EventCardIconMeta {
  url: string;
  contentW: number;
  contentH: number;
  cardW: number;
  cardH: number;
}

export interface EventCardIconOptions {
  photoUrl?: string;
  categoryEmoji: string;
  borderColors: [string, string];
  // Adds a pulsing blurred glow behind the card — mirrors the prototype's
  // "happening now" treatment for events currently in progress (see
  // isEventHappeningNow in eventHelpers.ts).
  happeningNow?: boolean;
}

export function buildEventCardIconDataUrl(options: EventCardIconOptions): EventCardIconMeta {
  const { photoUrl, categoryEmoji, borderColors, happeningNow = false } = options;
  const t = MARKER_TUNING;
  const [gradStart, gradEnd] = borderColors;
  // Position + sharpness of the color transition: at spread=100 the color
  // blends across the whole shape; a smaller spread pulls the two stops
  // toward the midpoint, down to a sharp diagonal split at spread=0.
  const stop1Offset = Math.max(0, t.gradientMidpoint - t.gradientSpread / 2);
  const stop2Offset = Math.min(100, t.gradientMidpoint + t.gradientSpread / 2);
  const cardLeft = 8,
    cardRight = 52,
    cardTop = 2,
    cardBottom = 66;
  const outline = buildOutlinePath(t.cornerRadius, t.shoulderRadius, t.tipRadius, t.pointerWidth, t.pointerHeight);
  const photoClip = buildPhotoClipPath(t.cornerRadius, t.photoWidth, t.photoHeight);
  const imgX = cardLeft + ((cardRight - cardLeft) - t.photoWidth) / 2;
  const imgY = cardTop + ((cardBottom - cardTop) - t.photoHeight) / 2;
  const imgW = t.photoWidth,
    imgH = t.photoHeight;

  const tipY = cardBottom + t.pointerHeight;
  const cardW = 60,
    cardH = Math.round(tipY + 4);

  // A glow needs extra canvas space around the card, or the blur gets
  // clipped at the SVG's own edge.
  const glowPad = happeningNow ? t.glowPad : 0;
  const contentW = cardW + glowPad * 2;
  const contentH = cardH + glowPad * 2;

  const uid = Math.random().toString(36).slice(2, 10);
  const clipId = `evclip-${uid}`;
  const outlineClipId = `evoutline-${uid}`;
  const gradId = `evgrad-${uid}`;
  const glowGradId = `evglowgrad-${uid}`;
  const glowId = `evglow-${uid}`;

  // The border itself stays put; the gradient *inside* it rotates — a large
  // gradient-filled rect spins behind a clip-path of the card's own outline,
  // rather than animating the gradientTransform directly (unreliable SMIL
  // rendering across browsers).
  const shapeCx = 30;
  const shapeCy = (cardTop + tipY) / 2;
  const rectSize = Math.max(cardW, cardH) * 3;
  const rectPos = { x: shapeCx - rectSize / 2, y: shapeCy - rectSize / 2 };
  // Always on: gradientRotationDuration is a fixed positive constant above
  // (0 disables it in the prototype's dynamic tuning panel, not ported here).
  const gradientRotation = `<animateTransform attributeName="transform" type="rotate" from="0 ${shapeCx} ${shapeCy}" to="360 ${shapeCx} ${shapeCy}" dur="${t.gradientRotationDuration}s" repeatCount="indefinite"/>`;

  const inner = photoUrl
    ? `<image href="${photoUrl}" x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>`
    : `<g clip-path="url(#${clipId})"><rect x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" fill="${gradStart}22"/><text x="30" y="${imgY + imgH / 2}" text-anchor="middle" font-size="22" dominant-baseline="middle">${categoryEmoji}</text></g>`;

  // The glow reuses the border's own gradient (rather than a flat color) so
  // it reads as one continuous shape — clipped to the card outline first,
  // then blurred (in that order, or the clip's own edge wouldn't blur too).
  const glow = happeningNow
    ? `
      <filter id="${glowId}" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="${t.glowBlur}"/>
      </filter>
      <g filter="url(#${glowId})">
        <g clip-path="url(#${outlineClipId})">
          <rect x="${rectPos.x}" y="${rectPos.y}" width="${rectSize}" height="${rectSize}" fill="url(#${glowGradId})">
            <animate attributeName="opacity" values="${t.glowOpacityMin};${t.glowOpacityMax};${t.glowOpacityMin}" dur="${t.glowDuration}s" repeatCount="indefinite"/>
            ${gradientRotation}
          </rect>
        </g>
      </g>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${contentW}" height="${contentH}" viewBox="0 0 ${contentW} ${contentH}">
    <defs>
      <clipPath id="${clipId}"><path d="${photoClip}"/></clipPath>
      <clipPath id="${outlineClipId}"><path d="${outline}"/></clipPath>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${shadeColor(gradStart, t.gradientLighten)}"/>
        <stop offset="${stop1Offset}%" stop-color="${shadeColor(gradStart, t.gradientLighten)}"/>
        <stop offset="${stop2Offset}%" stop-color="${shadeColor(gradEnd, t.gradientDarken)}"/>
        <stop offset="100%" stop-color="${shadeColor(gradEnd, t.gradientDarken)}"/>
      </linearGradient>
      <linearGradient id="${glowGradId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${shadeColor(gradStart, t.glowColorShade)}"/>
        <stop offset="${stop1Offset}%" stop-color="${shadeColor(gradStart, t.glowColorShade)}"/>
        <stop offset="${stop2Offset}%" stop-color="${shadeColor(gradEnd, t.glowColorShade)}"/>
        <stop offset="100%" stop-color="${shadeColor(gradEnd, t.glowColorShade)}"/>
      </linearGradient>
    </defs>
    <g transform="translate(${glowPad},${glowPad})">
      ${glow}
      <g clip-path="url(#${outlineClipId})">
        <rect x="${rectPos.x}" y="${rectPos.y}" width="${rectSize}" height="${rectSize}" fill="url(#${gradId})">
          ${gradientRotation}
        </rect>
      </g>
      ${inner}
    </g>
  </svg>`;

  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    contentW,
    contentH,
    cardW,
    cardH,
  };
}

// Translates the "logical" card size (w x h, from computeMarkerSize) into
// the actual scaledSize/anchor for this icon — accounts for any extra
// glow-padding canvas space so the card itself stays on scale and the
// pointer tip still lands exactly on the marker's location.
export function computeIconScaledSize(
  iconMeta: EventCardIconMeta,
  w: number,
  h: number,
): { scaledSize: { width: number; height: number }; anchor: { x: number; y: number } } {
  const scaleX = w / iconMeta.cardW;
  const scaleY = h / iconMeta.cardH;
  const scaledW = iconMeta.contentW * scaleX;
  const scaledH = iconMeta.contentH * scaleY;
  const anchorX = scaledW / 2;
  const anchorY = (scaledH * (iconMeta.contentH + iconMeta.cardH)) / (2 * iconMeta.contentH);
  return {
    scaledSize: { width: scaledW, height: scaledH },
    anchor: { x: anchorX, y: anchorY },
  };
}

// Ports getEventPhotoDataUrl from the prototype. SVGs used as a marker icon
// (a data-URI <img>) don't reliably load an external <image href="https://...">
// — it's an "image inside an image" the browser doesn't consistently fetch
// (confirmed: renders fine in Chromium, silently blank in WebKit/Safari,
// which is what real iOS users hit). So the photo is fetched once and
// converted to a base64 data URL, which does work embedded in the SVG.
// Deliberately not cached on failure — a transient fetch failure (e.g. too
// many concurrent requests during a batch re-render) shouldn't be
// remembered forever; the next call is allowed to retry.
const eventPhotoDataCache = new Map<string, Promise<string | null>>();

function fetchAsDataUrl(url: string): Promise<string> {
  return fetch(url, { mode: "cors" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.blob();
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    );
}

// Prefers the smaller thumbnail derivative (processPhotoUpload,
// functions/index.js) over the full original — markers render it small, no
// reason to fetch/decode the full-size image. Falls back to the original
// on any failure: a fresh upload's derivative can lag the original by the
// few seconds processPhotoUpload takes to generate it, and an external
// (business-supplied) photoUrl never had a derivative generated for it at
// all, in which case the "thumb" variant is just the original again —
// skip the pointless duplicate fetch for that case.
export function fetchEventPhotoDataUrl(photoUrl: string): Promise<string | null> {
  if (photoUrl.startsWith("data:")) return Promise.resolve(photoUrl);
  const cached = eventPhotoDataCache.get(photoUrl);
  if (cached) return cached;

  const thumbUrl = photoVariantUrl(photoUrl, "thumb");
  const promise = fetchAsDataUrl(thumbUrl)
    .catch(() => (thumbUrl === photoUrl ? Promise.reject() : fetchAsDataUrl(photoUrl)))
    .catch(() => {
      eventPhotoDataCache.delete(photoUrl);
      return null;
    });

  eventPhotoDataCache.set(photoUrl, promise);
  return promise;
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

// Matches the prototype's TILBURG_GREEN/TILBURG_ORANGE exactly — the
// second color here was previously #ff6b35 (a redder tomato-orange, not
// what the prototype actually uses).
export const DEFAULT_CARD_BORDER: [string, string] = ["#22c55e", "#ffa500"];

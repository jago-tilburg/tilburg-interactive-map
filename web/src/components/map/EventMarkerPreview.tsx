"use client";

import { useEffect, useId, useState } from "react";
import {
  buildEventCardIconDataUrl,
  computeMarkerSize,
  computeIconScaledSize,
  fetchEventPhotoDataUrl,
  shadeColor,
  DEFAULT_CARD_BORDER,
} from "@/lib/maps/markerIcons";
import { categoryOf } from "@/lib/events/eventHelpers";
import type { EventCategory } from "@/types/events";
import styles from "./EventMarkerPreview.module.css";

interface EventMarkerPreviewProps {
  category: EventCategory;
  umbrellaColor?: string;
  happeningNow?: boolean;
  // A not-yet-uploaded photo (its raw Blob, from PhotoUploadField's pending
  // state) takes priority over an already-saved photoUrl, resolved via the
  // same fetchEventPhotoDataUrl the real map marker uses — this is meant to
  // stay in lockstep with buildEventIcon in ShopMap.tsx, not reinvent it.
  photoBlob?: Blob | null;
  photoUrl?: string;
}

// Representative fixed zoom — there's no live map here to read a real zoom
// from; this is a "roughly what it'll look like" preview, not a pixel-exact
// simulation of every possible zoom level.
const PREVIEW_ZOOM = 15;

// Shows the exact marker icon (same SVG-building code as ShopMap.tsx's
// buildEventIcon) a business's event will render as on the map, so the
// preview button can answer "what does my photo look like as a pin", not
// just "what does the detail page look like".
export function EventMarkerPreview({ category, umbrellaColor, happeningNow = false, photoBlob, photoUrl }: EventMarkerPreviewProps) {
  const [resolvedPhoto, setResolvedPhoto] = useState<string | undefined>(undefined);
  // React's useId() (not Math.random()) — stable across the server render
  // and the client's hydration pass, unlike buildEventCardIconDataUrl's own
  // default random uid. Stripped of colons: useId() returns something like
  // ":r0:", and a colon inside an SVG id/url(#...) reference is asking for
  // trouble in a CSS context. See buildEventCardIconDataUrl's idSeed doc
  // comment for why this only matters here, not in ShopMap.tsx.
  const idSeed = useId().replace(/:/g, "");

  useEffect(() => {
    let cancelled = false;
    if (photoBlob) {
      const reader = new FileReader();
      reader.onload = () => {
        if (!cancelled) setResolvedPhoto(reader.result as string);
      };
      reader.readAsDataURL(photoBlob);
      return () => {
        cancelled = true;
      };
    }
    if (photoUrl) {
      fetchEventPhotoDataUrl(photoUrl).then((dataUrl) => {
        if (!cancelled) setResolvedPhoto(dataUrl ?? undefined);
      });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [photoBlob, photoUrl]);

  // Renders with no photo (category-emoji placeholder) whenever neither
  // input is present, regardless of any resolvedPhoto left over from a
  // previous photoBlob/photoUrl — avoids needing a synchronous setState
  // reset inside the effect above for that transition.
  const effectivePhoto = photoBlob || photoUrl ? resolvedPhoto : undefined;

  const borderColors: [string, string] = umbrellaColor ? [umbrellaColor, shadeColor(umbrellaColor, -30)] : DEFAULT_CARD_BORDER;
  const iconMeta = buildEventCardIconDataUrl({
    photoUrl: effectivePhoto,
    categoryEmoji: categoryOf(category).emoji,
    borderColors,
    happeningNow,
    idSeed,
  });
  const { w, h } = computeMarkerSize(PREVIEW_ZOOM);
  const { scaledSize } = computeIconScaledSize(iconMeta, w, h);

  return (
    <div className={styles.badge}>
      <img src={iconMeta.url} width={scaledSize.width} height={scaledSize.height} alt="" className={styles.icon} />
      <span className={styles.label}>Zo verschijnt je evenement op de kaart</span>
    </div>
  );
}

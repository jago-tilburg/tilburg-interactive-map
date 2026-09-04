"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/maps/loadGoogleMaps";
import {
  buildShopIconDataUrl,
  DROP_ICON_SIZE,
  DROP_ICON_ANCHOR,
  computeMarkerSize,
  buildEventCardIconDataUrl,
  computeIconScaledSize,
  fetchEventPhotoDataUrl,
  shadeColor,
  DEFAULT_CARD_BORDER,
} from "@/lib/maps/markerIcons";
import { categoryOf, isEventHappeningNow } from "@/lib/events/eventHelpers";
import { trackEvent } from "@/lib/analytics/trackEvent";
import {
  DROP_COLLECT_MS,
  DROP_DURATION_MS,
  dropBatches,
  dropEase,
  dropStartLat,
  prefersReducedMotion,
  shuffled,
} from "@/lib/maps/markerDrop";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./ShopMap.module.css";

const TILBURG_CENTER = { lat: 51.5555, lng: 5.0913 };

// Same warm-vintage custom style as the monolith's initMap().
const CUSTOM_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "administrative", elementType: "all", stylers: [{ visibility: "on" }, { lightness: 33 }] },
  { featureType: "landscape", elementType: "all", stylers: [{ color: "#f2e5d4" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#c5dac6" }] },
  { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "on" }, { lightness: 20 }] },
  { featureType: "road", elementType: "all", stylers: [{ lightness: 20 }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#c5c6c6" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e4d7c6" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#fbfaf7" }] },
  { featureType: "water", elementType: "all", stylers: [{ visibility: "on" }, { color: "#acbcc9" }] },
];

const LONG_PRESS_MS = 800;

interface ShopMapProps {
  apiKey: string;
  shops: Shop[];
  businessEvents: BusinessEvent[];
  umbrellaEvents?: UmbrellaEvent[];
  onShopClick: (shopId: number) => void;
  onBusinessEventClick: (eventId: string) => void;
  isAdmin?: boolean;
  onLongPressAdd?: (lat: number, lng: number) => void;
}

export function ShopMap({
  apiKey,
  shops,
  businessEvents,
  umbrellaEvents = [],
  onShopClick,
  onBusinessEventClick,
  isAdmin = false,
  onLongPressAdd,
}: ShopMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  // A null value is a *reserved* slot: this id is staged to fall but its
  // marker doesn't exist yet. Reserving the id up front is what stops the
  // sync effects below from creating a second, un-animated marker for it
  // while the drop queue is still working through its batches — the same
  // trick as the prototype's `pending: true` markerCache placeholders.
  const shopMarkersRef = useRef(new Map<number, google.maps.Marker | null>());
  const eventMarkersRef = useRef(new Map<string, google.maps.Marker | null>());
  // "pending" until the first batch of data has been collected and staged,
  // "done" from then on — after which every new marker appears silently.
  // Re-appearing after a filter toggle must not re-trigger the animation.
  const dropPhaseRef = useRef<"pending" | "done">("pending");
  // Every timer/rAF the drop owns, so unmounting mid-animation cancels them.
  const dropTimersRef = useRef<{ timeouts: number[]; frames: number[] }>({ timeouts: [], frames: [] });
  // Resolved photoUrl -> data URL, populated as fetchEventPhotoDataUrl()
  // resolves (see the effect below) so a re-render/rebuild for an
  // already-fetched photo doesn't re-fetch or flash back to the emoji.
  const eventPhotoDataRef = useRef(new Map<string, string>());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(13);
  // Flips once, when the collection window closes — the signal for the drop
  // effect below to stage everything gathered so far.
  const [dropReady, setDropReady] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Rebuilds event marker icons every 60s so the "happening now" glow turns
  // on/off as events start/end, without needing a page reload — mirrors the
  // prototype's checkHappeningNowChanges().
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: TILBURG_CENTER,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: CUSTOM_MAP_STYLE,
        });
        mapRef.current.addListener("zoom_changed", () => {
          /* v8 ignore next */
          setZoom(mapRef.current?.getZoom() ?? 13);
        });
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Kaart laden mislukt.");
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const shopIcon = useCallback(
    (rating: number, showLabel: boolean): google.maps.Icon => ({
      url: buildShopIconDataUrl(rating, showLabel),
      scaledSize: new google.maps.Size(DROP_ICON_SIZE.width, DROP_ICON_SIZE.height),
      anchor: new google.maps.Point(DROP_ICON_ANCHOR.x, DROP_ICON_ANCHOR.y),
    }),
    [],
  );

  const createShopMarker = useCallback(
    (map: google.maps.Map, shop: Shop, lat: number, showLabel: boolean) => {
      const marker = new google.maps.Marker({
        position: { lat, lng: shop.lng },
        map,
        title: shop.name,
        icon: shopIcon(shop.rating, showLabel),
      });
      marker.addListener("click", () => {
        trackEvent("shop_marker_click");
        onShopClick(shop.id);
      });
      shopMarkersRef.current.set(shop.id, marker);
      return marker;
    },
    [onShopClick, shopIcon],
  );

  const buildEventIcon = useCallback(
    (event: BusinessEvent, photoUrl: string | undefined): google.maps.Icon => {
      const { w, h } = computeMarkerSize(zoom);
      const parentUmbrella = event.umbrellaEventId
        ? umbrellaEvents.find((u) => u.id === event.umbrellaEventId)
        : undefined;
      const borderColors: [string, string] = parentUmbrella
        ? [parentUmbrella.color, shadeColor(parentUmbrella.color, -30)]
        : DEFAULT_CARD_BORDER;
      const iconMeta = buildEventCardIconDataUrl({
        photoUrl,
        categoryEmoji: categoryOf(event.category).emoji,
        borderColors,
        happeningNow: isEventHappeningNow(event, now),
      });
      const { scaledSize, anchor } = computeIconScaledSize(iconMeta, w, h);
      return {
        url: iconMeta.url,
        scaledSize: new google.maps.Size(scaledSize.width, scaledSize.height),
        anchor: new google.maps.Point(anchor.x, anchor.y),
      };
    },
    [umbrellaEvents, zoom, now],
  );

  const createEventMarker = useCallback(
    (map: google.maps.Map, event: BusinessEvent, lat: number) => {
      const resolvedPhoto = event.photoUrl ? eventPhotoDataRef.current.get(event.photoUrl) : undefined;
      const marker = new google.maps.Marker({
        position: { lat, lng: event.lng },
        map,
        title: event.title,
        icon: buildEventIcon(event, resolvedPhoto),
      });
      marker.addListener("click", () => {
        trackEvent("event_marker_click");
        onBusinessEventClick(event.id);
      });
      eventMarkersRef.current.set(event.id, marker);
      return marker;
    },
    [buildEventIcon, onBusinessEventClick],
  );

  // One pass over both marker kinds, mirroring the prototype's single
  // renderMarkersImmediate(): drop stale markers, then either stage the
  // first-visit animation or reconcile normally. Keeping it in one effect is
  // what makes the ordering safe — a split version had to bail out of one
  // effect while the other staged, and needed a state flip to recover.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const shopMarkers = shopMarkersRef.current;
    const eventMarkers = eventMarkersRef.current;
    const photoDataCache = eventPhotoDataRef.current;

    const shopIds = new Set(shops.map((s) => s.id));
    for (const [id, marker] of shopMarkers) {
      if (!shopIds.has(id)) {
        marker?.setMap(null);
        shopMarkers.delete(id);
      }
    }
    const eventIds = new Set(businessEvents.map((e) => e.id));
    for (const [id, marker] of eventMarkers) {
      if (!eventIds.has(id)) {
        marker?.setMap(null);
        eventMarkers.delete(id);
      }
    }

    // The "val uit de lucht" entrance, first visit only — ported from the
    // prototype's staging block. Shops and events go into ONE shuffled queue
    // so the two kinds fall mixed rather than in two waves, and
    // DROP_BATCH_SIZE of them are released every DROP_STAGGER_MS. Each starts
    // above the viewport's north edge and eases down to its real position.
    //
    // Runs once, ever. A marker that reappears later — a filter toggled back
    // on, a new event going live — comes back quietly instead of raining in.
    if (dropPhaseRef.current === "pending") {
      // Nothing is created until the collection window has closed, so shops
      // (RTDB) and events (Firestore) end up in the same queue.
      if (!dropReady) return;
      dropPhaseRef.current = "done";
      // Someone who asked for less motion gets them placed, not thrown — the
      // reconcile below then creates them all at their real positions.
      if (!prefersReducedMotion()) {
        const timers = dropTimersRef.current;
        const bounds = map.getBounds();
        const northEastLat = bounds ? bounds.getNorthEast().lat() : null;

        // Eases one marker's latitude from above the map down to the target.
        const fall = (
          marker: google.maps.Marker,
          startLat: number,
          targetLat: number,
          lng: number,
          onLand?: () => void,
        ) => {
          const startedAt = performance.now();
          const step = (frameTime: number) => {
            const t = Math.min((frameTime - startedAt) / DROP_DURATION_MS, 1);
            marker.setPosition({ lat: startLat + (targetLat - startLat) * dropEase(t), lng });
            if (t < 1) timers.frames.push(requestAnimationFrame(step));
            else onLand?.();
          };
          timers.frames.push(requestAnimationFrame(step));
        };

        const staged: (() => void)[] = [];
        for (const shop of shops) {
          // Reserve the id immediately, so the reconcile below leaves it for
          // its own batch instead of creating a second, un-animated marker
          // (the prototype's `pending: true` markerCache placeholder).
          shopMarkers.set(shop.id, null);
          staged.push(() => {
            const startLat = dropStartLat(shop.lat, northEastLat);
            const marker = createShopMarker(map, shop, startLat, false);
            // Shops fall label-less and reveal their rating on landing, so
            // the number doesn't jitter all the way down.
            fall(marker, startLat, shop.lat, shop.lng, () => marker.setIcon(shopIcon(shop.rating, true)));
          });
        }
        for (const event of businessEvents) {
          eventMarkers.set(event.id, null);
          staged.push(() => {
            const startLat = dropStartLat(event.lat, northEastLat);
            fall(createEventMarker(map, event, startLat), startLat, event.lat, event.lng);
          });
        }

        for (const batch of dropBatches(shuffled(staged))) {
          timers.timeouts.push(
            window.setTimeout(() => batch.items.forEach((release) => release()), batch.delayMs),
          );
        }
      }
    }

    for (const shop of shops) {
      // has(), not get(): a reserved slot holds null and must be left alone.
      if (shopMarkers.has(shop.id)) {
        shopMarkers.get(shop.id)?.setPosition({ lat: shop.lat, lng: shop.lng });
        continue;
      }
      createShopMarker(map, shop, shop.lat, true);
    }

    for (const event of businessEvents) {
      const resolvedPhoto = event.photoUrl ? photoDataCache.get(event.photoUrl) : undefined;

      if (eventMarkers.has(event.id)) {
        const existing = eventMarkers.get(event.id);
        if (existing) {
          existing.setPosition({ lat: event.lat, lng: event.lng });
          existing.setIcon(buildEventIcon(event, resolvedPhoto));
        }
      } else {
        createEventMarker(map, event, event.lat);
      }

      // photoUrl is a plain external URL (not yet a data URL) — kick off the
      // CORS-safe conversion and swap the icon in once it resolves, matching
      // the prototype's getEventPhotoDataUrl(). See fetchEventPhotoDataUrl's
      // own comment for why embedding the raw URL directly doesn't work.
      if (event.photoUrl && !resolvedPhoto) {
        const photoUrl = event.photoUrl;
        fetchEventPhotoDataUrl(photoUrl).then((dataUrl) => {
          if (!dataUrl) return;
          photoDataCache.set(photoUrl, dataUrl);
          eventMarkers.get(event.id)?.setIcon(buildEventIcon(event, dataUrl));
        });
      }
    }
  }, [
    ready,
    dropReady,
    shops,
    businessEvents,
    shopIcon,
    createShopMarker,
    buildEventIcon,
    createEventMarker,
  ]);

  // Opens the collection window. Deliberately keyed on data *arriving* rather
  // than on the map being ready: Maps loads well before RTDB/Firestore do, so
  // arming this on `ready` alone would let the window close over an empty
  // queue and every marker would then appear without ever falling. Restarting
  // on each change is the prototype's own renderMarkers() debounce, and it is
  // what lets shops and events be staged together.
  useEffect(() => {
    if (!ready || dropPhaseRef.current === "done" || dropReady) return;
    if (shops.length === 0 && businessEvents.length === 0) return;
    // No reason to hold markers back for a window whose only purpose is
    // grouping an animation that isn't going to run.
    const delay = prefersReducedMotion() ? 0 : DROP_COLLECT_MS;
    const timer = window.setTimeout(() => setDropReady(true), delay);
    return () => clearTimeout(timer);
  }, [ready, dropReady, shops, businessEvents]);

  useEffect(() => {
    const timers = dropTimersRef.current;
    return () => {
      timers.timeouts.forEach(clearTimeout);
      timers.frames.forEach(cancelAnimationFrame);
    };
  }, []);

  // Admin-only long-press-to-add: hold the map (not a marker) for 800ms to
  // trigger onLongPressAdd at that point. Uses the Maps API's own mouse
  // events (event.latLng is pre-resolved) rather than raw DOM + projection
  // math. Cancelled by a drag (map pan) so it never fires mid-pan.
  useEffect(() => {
    if (!ready || !mapRef.current || !isAdmin || !onLongPressAdd) return;
    const map = mapRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function clear() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    const downListener = map.addListener("mousedown", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      clear();
      timer = setTimeout(() => onLongPressAdd(lat, lng), LONG_PRESS_MS);
    });
    const upListener = map.addListener("mouseup", clear);
    const dragListener = map.addListener("dragstart", clear);

    return () => {
      clear();
      google.maps.event.removeListener(downListener);
      google.maps.event.removeListener(upListener);
      google.maps.event.removeListener(dragListener);
    };
  }, [ready, isAdmin, onLongPressAdd]);

  return (
    <div className={styles.wrapper}>
      {loadError && (
        <p role="alert" className={styles.error}>
          {loadError}
        </p>
      )}
      <div ref={containerRef} data-testid="map-container" className={styles.map} />
    </div>
  );
}
